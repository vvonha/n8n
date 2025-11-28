# n8n Template Gallery (self-hosted)

공개 접근이 제한된 오너 템플릿을 한눈에 보고, JSON 복사 또는 내 n8n 인스턴스로 바로 가져오기까지 지원하는 프론트엔드입니다. 최신 트렌드의 반응형 UI로 구성되어 테스트/데모 용도로 바로 띄울 수 있습니다.

## 주요 기능
- 템플릿 검색과 태그 필터링
- 상세 모달에서 난이도/필요 자격증명/예상 셋업 시간 확인
- JSON 미리보기 및 클립보드 복사
- 호스트 URL + Personal Access Token(PAT) 입력 후 **POST /rest/workflows** 호출로 워크플로우 생성
- 예시 템플릿 3종 내장 (공지, 리드 처리, 데일리 리포트)

## 로컬 실행
```bash
npm install
npm run dev  # http://localhost:5173
```

## 프로덕션 빌드
```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Docker 이미지 빌드/실행
```bash
docker build -t n8n-template-gallery .
docker run -p 8080:80 n8n-template-gallery
```

## Helm 차트 배포(EKS 등)
- 차트 위치: `charts/n8n-template-gallery`
- 기본적으로 정적 프론트엔드만 배포하므로 추가 PVC 없이 바로 실행됩니다.

```bash
helm upgrade --install template-gallery charts/n8n-template-gallery \
  --set image.repository=<레지스트리>/n8n-template-gallery \
  --set image.tag=<태그> \
  --set service.type=LoadBalancer \
  --set ingress.enabled=true \
  --set ingress.className=alb \
  --set ingress.hosts[0].host=gallery.example.com \
  --set ingress.hosts[0].paths[0].path=/
```

- 기본 설정은 HPA(cpu/memory 75%)가 활성화된 상태이며, `values.yaml`을 통해 `replicaCount`, 추가 환경변수(`env`), `serviceMonitor` 등을 조정할 수 있습니다.
- 퍼블릭 도메인 노출 시 Ingress + TLS 설정을 추천하며, n8n API 도메인에 대한 CORS 허용을 잊지 마세요.

## n8n API 연결 방법
1. 갤러리 페이지 우측 패널에 **n8n 호스트 URL** 과 **PAT** 을 입력합니다.
2. 카드 또는 모달의 "내 워크플로우로 가져오기" 버튼을 누르면 브라우저에서 직접 `POST /rest/workflows` 를 호출합니다.
3. CORS 설정이 필요할 수 있으며, 토큰은 클라이언트에 저장하지 않습니다.

## 이 서비스에 DB가 필요한가요?
- 기본적으로 **DB가 필요 없습니다.** 템플릿 메타데이터와 JSON은 정적 파일(`src/data/templates.ts`에서 번들)로 포함되어 있으며, 클라이언트가 n8n REST API를 직접 호출합니다.
- 템플릿을 동적으로 추가·수정하거나 즐겨찾기/카운터 같은 상태를 저장하려면 별도 백엔드(DB + API)를 붙이는 것이 좋습니다. 그 경우에도 갤러리 UI는 API 주소만 주입하면 됩니다.

## 쿠버네티스 배포 & 스토리지(PV) 고려사항
- **권장 구성:** `NodePort`/`LoadBalancer` 서비스로 80/443을 노출하거나, Ingress + TLS를 사용합니다. 애플리케이션은 정적 파일을 서빙하는 단일 컨테이너이므로 HPA로 손쉽게 수평 확장할 수 있습니다.
- **PersistentVolume 필요 여부:** 정적 애플리케이션이므로 기본적으로 PV가 필요 없습니다. 빌드 결과를 컨테이너 이미지에 포함하거나 ConfigMap/OCI Registry에서 직접 가져오면 됩니다.
- **ConfigMap 방식 예시:**
  1. `npm run build`로 생성된 `dist/`를 ConfigMap에 넣거나 Nginx-alpine 기반 이미지를 빌드합니다.
  2. Deployment에서 `/usr/share/nginx/html`을 ConfigMap/빈Dir로 마운트하면 코드 변경 시 롤링 업데이트만으로 반영 가능합니다.
- **환경변수 주입:** n8n 호스트 기본값을 클러스터 도메인으로 고정하고 싶다면 `VITE_DEFAULT_N8N_HOST` 같은 환경변수를 추가해 `import.meta.env`로 읽어 UI에 반영하세요.
- **네트워크:** EKS에서 퍼블릭 도메인으로 제공 시 Ingress(ALB/NGINX) + `https`를 적용하고, n8n API 도메인에 대해 CORS 허용을 맞춰줍니다.

## 구조
- `src/data/templates.ts` : 갤러리 노출용 템플릿 메타/JSON
- `src/utils/n8nClient.ts` : n8n REST API 호출 래퍼
- `src/components/` : 카드/모달 UI 컴포넌트
- `src/styles/global.css` : 글래스모피즘 기반의 글로벌 스타일
