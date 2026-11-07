# RE:RPG

web-rpg by deuwel

장비 파밍, 속도 기반 시간축 전투, 직업 조합과 페르소나, 다층 Prestige로 성장하는 웹 RPG 프로젝트입니다. RE:RPG는 임시 제목입니다.

## 개발 기준 문서

- [게임 기획서 v0.2](docs/GAME_DESIGN.md) — 게임 규칙, 세계와 던전, 전술, 장비와 경제, 회귀 / 환생 / 개변 / 창조, 직업과 페르소나, 영구 마스터리
- [개발 가이드라인 v0.2](docs/DEVELOPMENT_GUIDELINES.md) — 구현 책임, 네온 도형 UI, 데이터와 저장, 전투 이벤트, 큰 수 처리, 검증 기준

## A 단계 | 전투와 파밍

윈드해븐에서 탐험을 시작해 적을 처치하고 장비를 모읍니다. 같은 깊이에서 일반 전투 10승을 거둔 뒤 마을로 귀환하면 들판의 감시자에게 도전할 수 있습니다.

[구현 범위와 첫 플레이 가이드](docs/STAGE_A.md)

### 로컬 실행

Node.js 20 이상과 Python 3 환경에서 실행합니다. 별도 패키지 설치는 필요하지 않습니다.

```sh
npm test
npm run build
python3 -m http.server 8000 --directory dist
```

브라우저에서 `http://localhost:8000`을 엽니다. 진행 상황은 사용한 브라우저에 저장됩니다. 설정에서 JSON 파일로 내보내거나 다른 기기에서 불러올 수 있습니다.
