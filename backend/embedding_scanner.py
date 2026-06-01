print("[Scanner Debug] 1. 기본 모듈(os, json) 불러오는 중...")
import os
import json

print("[Scanner Debug] 2. numpy 불러오는 중...")
import numpy as np

print("[Scanner Debug] 3. sklearn 불러오는 중...")
from sklearn.metrics.pairwise import cosine_similarity

print("[Scanner Debug] 4. chromadb 불러오는 중...")
import chromadb

print("[Scanner Debug] 5. sentence_transformers 불러오는 중...")
from sentence_transformers import SentenceTransformer

print("[Scanner Debug] 6. 모든 모듈 로딩 완료! 클래스 정의 시작...")

class EmbeddingScanner:
    def __init__(self, db_path: str = "./vector_db", seed_file: str = "seeds.json"):
        # 한국어/영어 의미 분석을 위한 다국어 모델
        self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        self.chroma_client = chromadb.PersistentClient(path=db_path)
        self.collection = self.chroma_client.get_or_create_collection(name="attack_vectors")
        
        # 외부 JSON 파일 경로 설정
        self.seed_file = seed_file
        
        # 컬렉션이 비어있을 때만 Seed Data 적재
        if self.collection.count() == 0:
            self._inject_seed_data()

    def _inject_seed_data(self):
        """외부 JSON 파일에서 Seed 데이터를 읽어와 벡터 DB에 적재합니다."""
        
        # JSON 파일 존재 여부 확인
        if not os.path.exists(self.seed_file):
            print(f"[Error] {self.seed_file} 파일을 찾을 수 없습니다. 빈 DB로 시작합니다.")
            return

        # JSON 파일 파싱
        with open(self.seed_file, 'r', encoding='utf-8') as f:
            try:
                seed_data = json.load(f)
            except json.JSONDecodeError:
                print(f"[Error] {self.seed_file}의 JSON 형식이 올바르지 않습니다.")
                return

        all_seeds = []
        metadatas = []

        # JSON 구조에 따라 데이터 평탄화(Flattening)
        for category in seed_data.get("categories", []):
            cat_type = category.get("type", "Unknown")
            risk_score = category.get("risk", 50)
            seeds = category.get("seeds", [])

            for seed_text in seeds:
                all_seeds.append(seed_text)
                metadatas.append({
                    "type": cat_type, 
                    "risk": risk_score
                })

        if not all_seeds:
            print("[Warning] 적재할 Seed 데이터가 없습니다.")
            return

        # 임베딩 생성 및 DB 적재
        embeddings = self.model.encode(all_seeds).tolist()
        ids = [f"seed_{i}" for i in range(len(all_seeds))]
        
        self.collection.add(
            embeddings=embeddings,
            documents=all_seeds,
            metadatas=metadatas,
            ids=ids
        )
        print(f"총 {len(all_seeds)}개의 자연어 Seed Data가 Vector DB에 성공적으로 적재되었습니다.")

    def analyze(self, user_input: str) -> dict:
        """입력 텍스트와 DB 내 공격 벡터의 의미적 유사도를 평가합니다."""
        input_vector = self.model.encode([user_input])
        
        results = self.collection.query(
            query_embeddings=input_vector.tolist(),
            n_results=1,
            include=["embeddings", "documents", "metadatas"]
        )
        
        if len(results['embeddings'][0]) == 0:
            return {"detected": False, "risk_score": 0}

        best_match_vector = np.array(results['embeddings'][0][0])
        attack_category = results['metadatas'][0][0]['type']
        base_risk = results['metadatas'][0][0]['risk']
        
        similarity = cosine_similarity(input_vector, [best_match_vector])[0][0]
        
        # 유사도가 82% 이상이면 완벽한 의미적 일치로 간주
        if similarity >= 0.95:
            return {
                "detected": True,
                "attack_type": f"Semantic_{attack_category}",
                "risk_score": base_risk,
                "similarity": round(float(similarity), 3)
            }
        elif similarity >= 0.89:
            return {
                "detected": True,
                "attack_type": "Suspected_Variant",
                "risk_score": min(base_risk, 40), 
                "similarity": round(float(similarity), 3)
            }

        return {"detected": False, "risk_score": 0}