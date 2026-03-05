import os
import requests
import json
import numpy as np

# Load credentials from the environment (falling back to the standard endpoints)
AI100_BASE_URL = os.getenv("AI100_BASE_URL", "https://aisuite.cirrascale.com/apis/v2")
AI100_API_KEY = os.getenv("AI100_API_KEY")

# Expected to be set in your .env, e.g. BAAI/bge-base-en-v1.5
AI100_EMBEDDING_MODEL = os.getenv("AI100_EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")


def get_embedding(text: str) -> list:
    """
    Generates a dense vector embedding for the input text using Cirrascale AI 100 API.
    Returns: List of floats.
    """
    if not AI100_API_KEY:
        print("[AI100 Embeddings] Error: AI100_API_KEY is not set.")
        return []

    url = f"{AI100_BASE_URL}/embeddings"
    headers = {
        "Authorization": f"Bearer {AI100_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": AI100_EMBEDDING_MODEL,
        "input": text,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        
        if response.status_code != 200:
            print(f"[AI100 Embeddings] API Error {response.status_code}: {response.text[:200]}")
            return []
            
        data = response.json()
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]
        else:
            print("[AI100 Embeddings] Error: Unexpected API response structure.")
            return []
            
    except Exception as e:
        print(f"[AI100 Embeddings] Exception during HTTP request: {e}")
        return []

def search_similar_vectors(query_embedding: list, all_vectors: list, top_k=5):
    """
    Manually compute cosine similarity if vector search is not available in DB.
    all_vectors: List of {'id': str, 'vector': list}
    """
    if not all_vectors or not query_embedding:
        return []
        
    query_vec = np.array(query_embedding)
    query_norm = np.linalg.norm(query_vec)
    
    if query_norm == 0:
        return []
        
    similarities = []
    for item in all_vectors:
        vec = np.array(item['vector'])
        vec_norm = np.linalg.norm(vec)
        
        if vec_norm == 0:
            score = 0
        else:
            score = np.dot(query_vec, vec) / (query_norm * vec_norm)
            
        similarities.append({'id': item['id'], 'score': score})
        
    similarities.sort(key=lambda x: x['score'], reverse=True)
    return similarities[:top_k]
