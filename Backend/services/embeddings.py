from sentence_transformers import SentenceTransformer
import numpy as np

# Load a lightweight model for embeddings
embedding_model = SentenceTransformer('all-MiniLM-L6-v2') 

def get_embedding(text: str) -> list:
    """
    Generates a dense vector embedding for the input text using sentence-transformers.
    Returns: List of floats.
    """
    try:
        embedding = embedding_model.encode(text)
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return []

def search_similar_vectors(query_embedding: list, all_vectors: list, top_k=5):
    """
    Manually compute cosine similarity if vector search is not available in DB.
    all_vectors: List of {'id': str, 'vector': list}
    """
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    
    if not all_vectors:
        return []
        
    query_vec = np.array([query_embedding])
    
    similarities = []
    for item in all_vectors:
        vec = np.array([item['vector']])
        score = cosine_similarity(query_vec, vec)[0][0]
        similarities.append({'id': item['id'], 'score': score})
        
    similarities.sort(key=lambda x: x['score'], reverse=True)
    return similarities[:top_k]
