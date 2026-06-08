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

    def compress(self, docs):
        if not docs:
            return ""

        combined = "\n\n".join(docs)

        compressed = self.compressor.compress_prompt(
            combined,
            rate=self.compression_rate,
        )

        return compressed["compressed_prompt"]

    def optimize(self, query, graph_ctx=None, memory_ctx=None, docs=None):
        graph_ctx = graph_ctx or []
        memory_ctx = memory_ctx or []
        docs = docs or []

        combined = [
            normalized
            for normalized in (self._normalize_doc(doc) for doc in graph_ctx + memory_ctx + docs)
            if normalized
        ]

        if not combined:
            return ""

        # Deduplicate before reranking so duplicate chunks do not consume the
        # limited max_chunks budget that rerank applies.
        unique = self.dedupe(combined)
        ranked = self.rerank(query, unique)
        compressed = self.compress(ranked)

        return compressed
