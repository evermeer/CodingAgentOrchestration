from sentence_transformers import CrossEncoder, SentenceTransformer, util
from llmlingua import PromptCompressor
import sys

def log(message):
    try:
        sys.stderr.write(f"[context-optimizer] {message}\n")
        sys.stderr.flush()
    except Exception:
        pass


try:
    import torch
except Exception:
    torch = None

class ContextOptimizer:
    def __init__(
        self,
        reranker_model="BAAI/bge-reranker-large",
        embed_model="all-MiniLM-L6-v2",
        compression_rate=0.5,
        max_chunks=6,
        dedupe_threshold=0.9,
        graph_budget_chars=1200,
        memory_budget_chars=1200,
        docs_budget_chars=1600,
        total_prune_budget_chars=4000,
        model_limits=None,
        error_prefixes=None,
        protected_prefixes=None,
    ): 
        device = "cuda" if torch is not None and torch.cuda.is_available() else "cpu"
        # Keep the LLMLingua-2 algorithm on both devices; on CPU use the smaller
        # multilingual BERT checkpoint instead of the large xlm-roberta model so
        # the optimizer stays responsive without a CUDA GPU.
        compressor_model = (
            "microsoft/llmlingua-2-xlm-roberta-large-meetingbank"
            if device == "cuda"
            else "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank"
        )

        log(
            f"initializing optimizer device={device} reranker={reranker_model} embedder={embed_model} compressor={compressor_model}"
        )

        self.reranker = CrossEncoder(reranker_model, device=device)
        self.embedder = SentenceTransformer(embed_model, device=device)
        self.compressor = PromptCompressor(
            model_name=compressor_model,
            use_llmlingua2=True,
            device_map=device,
        )

        self.compression_rate = compression_rate
        self.max_chunks = max_chunks
        self.dedupe_threshold = dedupe_threshold
        self.graph_budget_chars = graph_budget_chars
        self.memory_budget_chars = memory_budget_chars
        self.docs_budget_chars = docs_budget_chars
        self.total_prune_budget_chars = total_prune_budget_chars
        self.model_limits = model_limits or {}
        self.error_prefixes = tuple(error_prefixes or ("[error]", "[context-optimizer] error"))
        self.protected_prefixes = tuple(protected_prefixes or ("protected:",))

        log("optimizer initialized")

    def rerank(self, query, docs):
        pairs = [(query, doc) for doc in docs]
        scores = self.reranker.predict(pairs)
        ranked = [doc for _, doc in sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)]
        return ranked[: self.max_chunks]

    def _normalize_doc(self, doc):
        if isinstance(doc, str):
            return doc.strip()

        if isinstance(doc, (list, tuple)):
            parts = [str(part).strip() for part in doc if part is not None and str(part).strip()]
            return " ".join(parts).strip()

        return str(doc).strip()

    def _is_prefixed(self, doc, prefixes):
        lowered = doc.lower()
        return any(lowered.startswith(prefix.lower()) for prefix in prefixes)

    def _purge_error_docs(self, docs):
        return [doc for doc in docs if not self._is_prefixed(doc, self.error_prefixes)]

    def dedupe(self, docs):
        if not docs:
            return docs

        embeddings = self.embedder.encode(docs, convert_to_tensor=True)

        unique_docs = []
        unique_embeddings = []

        for i, emb in enumerate(embeddings):
            if not unique_embeddings:
                unique_docs.append(docs[i])
                unique_embeddings.append(emb)
                continue

            similarities = [util.cos_sim(emb, u_emb).item() for u_emb in unique_embeddings]

            if max(similarities) < self.dedupe_threshold:
                unique_docs.append(docs[i])
                unique_embeddings.append(emb)

        return unique_docs

    def _budget_for_bucket(self, bucket_name):
        if bucket_name == "graph_ctx":
            return self.graph_budget_chars
        if bucket_name == "memory_ctx":
            return self.memory_budget_chars
        return self.docs_budget_chars

    def _pre_prune(self, query, graph_ctx, memory_ctx, docs):
        buckets = {
            "graph_ctx": [
                normalized
                for normalized in (self._normalize_doc(doc) for doc in graph_ctx)
                if normalized
            ],
            "memory_ctx": [
                normalized
                for normalized in (self._normalize_doc(doc) for doc in memory_ctx)
                if normalized
            ],
            "docs": [
                normalized
                for normalized in (self._normalize_doc(doc) for doc in docs)
                if normalized
            ],
        }

        bucket_stats = {}

        for bucket_name, bucket in buckets.items():
            if not bucket:
                continue

            ranked_with_scores = sorted(
                zip(self.reranker.predict([(query, doc) for doc in bucket]), bucket),
                key=lambda x: x[0],
                reverse=True,
            )
            ranked_docs = self.dedupe([doc for _, doc in ranked_with_scores])
            score_for_doc = {}

            for score, doc in ranked_with_scores:
                score_for_doc.setdefault(doc, score)

            total_score = sum(max(score_for_doc.get(doc, 0), 0) for doc in ranked_docs)
            total_chars = sum(len(doc) for doc in ranked_docs)

            bucket_stats[bucket_name] = {
                "ranked": ranked_docs,
                "scores": score_for_doc,
                "total_score": total_score,
                "total_chars": total_chars,
            }

        pruned = []
        remaining = self.total_prune_budget_chars
        active_buckets = [name for name in ("graph_ctx", "memory_ctx", "docs") if name in bucket_stats]

        if not active_buckets or remaining <= 0:
            return pruned

        ordered_buckets = sorted(
            active_buckets,
            key=lambda name: (
                bucket_stats[name]["total_score"] / max(bucket_stats[name]["total_chars"], 1),
                bucket_stats[name]["total_score"],
                -bucket_stats[name]["total_chars"],
            ),
            reverse=True,
        )

        for bucket_name in ordered_buckets:
            stats = bucket_stats.get(bucket_name)
            if stats is None or remaining <= 0:
                continue

            bucket_budget = remaining
            bucket_total = 0

            for doc in stats["ranked"]:
                score = stats["scores"].get(doc, 0)
                doc_len = len(doc)
                if doc_len > bucket_budget:
                    if bucket_total == 0 and score > 0:
                        pruned.append(doc)
                        remaining -= doc_len

                        if remaining <= 0:
                            return pruned

                        break

                    continue

                if bucket_total + doc_len > bucket_budget:
                    continue

                pruned.append(doc)
                bucket_total += doc_len
                remaining -= doc_len

                if remaining <= 0:
                    return pruned

        return pruned

    def compress(self, docs):
        if not docs:
            return ""

        compressed = self.compressor.compress_prompt(
            docs,
            rate=self.compression_rate,
        )

        return compressed["compressed_prompt"]

    def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None, model=None, options=None):
        graph_ctx = graph_ctx or []
        memory_ctx = memory_ctx or []
        docs = docs or []
        options = options or {}

        # Protect tagged docs from the error purge / pre-prune path while still
        # allowing the normal rerank/compress flow to act on them.
        graph_ctx = [doc for doc in graph_ctx if self._normalize_doc(doc)]
        memory_ctx = [doc for doc in memory_ctx if self._normalize_doc(doc)]
        docs = [doc for doc in docs if self._normalize_doc(doc)]

        graph_ctx = self._purge_error_docs([self._normalize_doc(doc) for doc in graph_ctx])
        memory_ctx = self._purge_error_docs([self._normalize_doc(doc) for doc in memory_ctx])
        docs = self._purge_error_docs([self._normalize_doc(doc) for doc in docs])

        effective_compression_rate = self.compression_rate
        effective_max_chunks = self.max_chunks

        limit = None
        if isinstance(model, str) and model:
            limit = self.model_limits.get(model)
        if limit is None:
            limit = self.model_limits.get(options.get("model") or "default")

        if isinstance(limit, dict):
            if isinstance(limit.get("compression_rate"), (int, float)):
                effective_compression_rate = limit["compression_rate"]
            if isinstance(limit.get("max_chunks"), int):
                effective_max_chunks = limit["max_chunks"]

        combined = self._pre_prune(query, graph_ctx, memory_ctx, docs)

        if not combined:
            return ""

        # Deduplicate before reranking so duplicate chunks do not consume the
        # limited max_chunks budget that rerank applies.
        unique = self.dedupe(combined)
        original_max_chunks = self.max_chunks
        original_compression_rate = self.compression_rate
        try:
            self.max_chunks = effective_max_chunks
            self.compression_rate = effective_compression_rate
            ranked = self.rerank(query, unique)
            compressed = self.compress(ranked)
        finally:
            self.max_chunks = original_max_chunks
            self.compression_rate = original_compression_rate

        return compressed
