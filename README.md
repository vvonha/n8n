# n8n Template Gallery (self-hosted)

공개 접근이 제한된 오너 템플릿을 한눈에 보고, JSON 복사 또는 내 n8n 인스턴스로 바로 가져오기까지 지원하는 프론트엔드입니다. 최신 트렌드의 반응형 UI로 구성되어 테스트/데모 용도로 바로 띄울 수 있습니다.

## 주요 기능
- 템플릿 검색과 태그 필터링
- 상세 모달에서 난이도/필요 자격증명/예상 셋업 시간 확인
- JSON 미리보기 및 클립보드 복사
- 호스트 URL + 인증(개인 토큰 / Basic Auth / 세션 쿠키)으로 **POST /rest/workflows** 호출 후 워크플로우 생성
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
1. 갤러리 페이지 우측 패널에 **n8n 호스트 URL**을 입력합니다.
2. 인증 방식을 고릅니다.
   - **Personal Access Token(PAT)**: n8n 좌측 사이드바 → **Settings → Personal Access Tokens**에서 토큰을 발급 후 입력합니다.
   - **Basic Auth**: n8n에 Basic Auth를 켜둔 경우, 사용자명/비밀번호를 입력합니다.
   - **세션 쿠키**: 갤러리와 n8n이 동일(또는 서브)도메인이고 이미 로그인 쿠키가 있을 때 Authorization 헤더 없이 호출합니다.
3. 카드 또는 모달의 "내 워크플로우로 가져오기" 버튼을 누르면 브라우저에서 직접 `POST /rest/workflows` 를 호출합니다.
4. 별도 서버에 자격증명을 저장하지 않으며, CORS/쿠키 정책은 배포 도메인에 맞춰 허용해야 합니다.

## n8n CORS & credentials 설정 (self-hosted, ALB)
- **환경변수로 제어**: n8n 서버에 아래 값을 추가하면 갤러리 도메인에서 `credentials: include` 요청을 받을 수 있습니다.

  ```yaml
  # 예: n8n Deployment/StatefulSet의 env 항목 또는 docker-compose
  - name: N8N_CORS_ALLOW_ORIGIN
    value: https://gallery.example.com,https://n8n.example.com
  - name: N8N_CORS_ALLOW_METHODS
    value: GET,POST,PUT,DELETE,OPTIONS
  - name: N8N_CORS_ALLOW_HEADERS
    value: Authorization,Content-Type,User-Agent
  - name: N8N_CORS_ALLOW_CREDENTIALS
    value: "true"
  - name: N8N_CORS_MAX_AGE
    value: "1728000" # 20일 프리플라이트 캐시
  ```

- **Origin은 와일드카드 금지**: `Allow-Credentials` 를 켜면 `*` 를 쓸 수 없으므로 갤러리/에디터 도메인을 콤마로 명시합니다.
- **세션 쿠키 방식**: 갤러리와 n8n을 동일/서브도메인으로 두면 추가 설정 없이도 쿠키를 재사용하기 쉽습니다. 다른 도메인이면 CORS 허용 + HTTPS 환경에서만 쿠키가 전송됩니다.
- **ALB Ingress 참고**: CORS 헤더는 n8n 애플리케이션이 내려주므로 ALB 쪽에 별도 설정이 필요 없습니다. 다만 HTTPS 리다이렉트(예: `alb.ingress.kubernetes.io/ssl-redirect: '443'`)와 원하는 호스트로의 라우팅만 맞춰주면 됩니다.

### CORS 트러블슈팅 체크리스트
- **실제 응답 확인**: 아래와 같이 `OPTIONS` 프리플라이트를 직접 호출해 `Access-Control-Allow-*` 헤더가 포함되는지 봅니다. 헤더가 없다면 n8n 프로세스까지 도달하지 못했거나 환경변수가 반영되지 않은 것입니다.

  ```bash
  curl -i -X OPTIONS https://n8n.example.com/rest/workflows \
    -H "Origin: https://gallery.example.com" \
    -H "Access-Control-Request-Method: POST"
  ```

  기대값 예시: `HTTP/2 204` 혹은 `200` + `Access-Control-Allow-Origin: https://gallery.example.com`, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers: Authorization,Content-Type,...` 등이 포함되어야 합니다.
  - **CORS 헤더가 전혀 없을 때**: `Allow: GET, HEAD, POST` 같은 최소 헤더만 보이면 n8n이 CORS 설정을 못 읽었거나(환경변수 공백/오타, Pod 미재시작), ALB/Ingress 레이어에서 응답을 끝내고 n8n에 도달하지 못한 것입니다. 먼저 `kubectl exec`로 `printenv | grep N8N_CORS`를 확인하고, Ingress에서 `/rest/` 경로가 올바르게 라우팅되는지 살펴보세요.

- **Ingress/ALB가 OPTIONS를 건드리는지 확인**: ALB 리다이렉트나 인증이 `OPTIONS`를 301/401로 응답하면 CORS가 실패합니다. Ingress에서 OPTIONS는 그대로 n8n으로 패스하고, `alb.ingress.kubernetes.io/auth-*` 설정을 썼다면 OPTIONS에 대해 우회 규칙을 추가합니다.

- **환경변수 반영 여부**: Pod를 재시작한 뒤 `kubectl exec`로 `printenv | grep N8N_CORS`를 확인해 값이 들어갔는지 확인합니다. 스페이스가 끼어 있으면 그대로 Origin 비교에 실패할 수 있으니 `https://gallery.example.com,https://n8n.example.com` 형태로 공백 없이 넣습니다.

- **Allow-Headers 확장**: 브라우저가 보내는 헤더(`Cookie`, `Accept`, `X-Requested-With` 등)가 프리플라이트에 포함되면 `N8N_CORS_ALLOW_HEADERS`에도 추가해 줍니다. 프리플라이트에서 하나라도 거절되면 본 요청이 막힙니다.

- **캐싱/프록시**: CDN이나 프록시가 프리플라이트를 캐싱하고 있다면 `N8N_CORS_MAX_AGE`를 낮추거나 캐시를 무효화합니다.

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
