from sentence_transformers import CrossEncoder, SentenceTransformer, util
from llmlingua import PromptCompressor

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
        compressor_model = (
            "microsoft/llmlingua-2-xlm-roberta-large-meetingbank"
            if device == "cuda"
            else "openai-community/gpt2"
        )

        self.reranker = CrossEncoder(reranker_model, device=device)
        self.embedder = SentenceTransformer(embed_model, device=device)
        self.compressor = PromptCompressor(
            model_name=compressor_model,
            device_map=device,
        )

        self.compression_rate = compression_rate
        self.max_chunks = max_chunks
        self.dedupe_threshold = dedupe_threshold

    def rerank(self, query, docs):
        pairs = [(query, doc) for doc in docs]
        scores = self.reranker.predict(pairs)
        ranked = [doc for _, doc in sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)]
        return ranked[: self.max_chunks]

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

    def optimize(self, query, graph_ctx=None, memory_ctx=None):
        graph_ctx = graph_ctx or []
        memory_ctx = memory_ctx or []

        combined = graph_ctx + memory_ctx

        if not combined:
            return ""

        ranked = self.rerank(query, combined)
        unique = self.dedupe(ranked)
        compressed = self.compress(unique)

        return compressed
