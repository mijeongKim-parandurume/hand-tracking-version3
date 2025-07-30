# 웹캠 핸드 트래킹 데모

웹캠을 사용한 3D 핸드 트래킹 인터랙션 데모입니다. MediaPipe, Three.js, 그리고 CANNON.js를 활용하여 손을 감지하고 3D 객체와 상호작용할 수 있습니다.

## 기능

- 실시간 손 추적 (양손 지원)
- 핀치 제스처로 객체 집기
- 손 전체로 객체 잡기
- 양손으로 객체 회전
- 물리 기반 객체 이동 및 충돌

## 필요 사항

- 웹캠이 있는 컴퓨터
- 최신 웹 브라우저 (Chrome, Firefox, Edge)
- 로컬 웹 서버

## 설치 및 실행

1. 프로젝트 폴더 구조 생성:
   ```
   hand-tracking-demo/
   ├── index.html
   ├── css/
   │   └── styles.css
   ├── js/
   │   ├── main.js
   │   ├── physics.js
   │   ├── scene.js
   │   ├── handTracking.js
   │   ├── interactions.js
   │   └── utils.js
   └── README.md
   ```

2. 모든 파일을 해당 위치에 복사

3. 로컬 웹 서버 실행:
   - Python 사용:
     ```bash
     python -m http.server 8000
     ```
   - Node.js 사용:
     ```bash
     npx http-server
     ```

4. 브라우저에서 `http://localhost:8000` 접속

## 사용 방법

1. 웹캠 접근 권한 허용
2. 손을 웹캠 앞에서 움직여 다음 동작 수행:
   - 엄지와 검지를 붙여 핀치 제스처로 큐브 집기 (빨간색)
   - 손을 오므려 손 전체로 큐브 잡기 (파란색)
   - 양손으로 동시에 물체를 잡아 회전 (노란색)
   - 잡은 상태에서 손을 움직인 후 놓아 물체 던지기

## 기술 스택

- **Three.js**: 3D 그래픽 렌더링
- **MediaPipe Hands**: 손 추적 및 랜드마크 감지
- **CANNON.js**: 물리 시뮬레이션
- **MediaPipe Camera Utils**: 웹캠 제어

## 파일 구조 설명

- `index.html`: 메인 HTML 파일
- `css/styles.css`: UI 스타일 정의
- `js/main.js`: 애플리케이션 진입점 및 전역 변수 관리
- `js/physics.js`: CANNON.js 물리 세계 설정
- `js/scene.js`: Three.js 씬 구성 및 3D 객체 관리
- `js/handTracking.js`: MediaPipe 핸드 트래킹 초기화 및 처리
- `js/interactions.js`: 상호작용 로직 (집기, 회전, 던지기)
- `js/utils.js`: 유틸리티 함수

## 문제 해결

1. **웹캠이 작동하지 않는 경우**:
   - 브라우저가 웹캠 접근을 차단하지 않았는지 확인
   - HTTPS 환경이 필요할 수 있음 (로컬에서는 localhost 사용)

2. **손 인식이 되지 않는 경우**:
   - 조명이 충분한지 확인
   - 웹캠 앞에서 손을 명확히 보이도록 위치

3. **성능 문제**:
   - 브라우저와 그래픽 드라이버 최신 버전으로 업데이트
   - 다른 리소스 집약적인 프로그램 종료

## 라이선스

이 프로젝트는 자유롭게 사용 및 수정할 수 있습니다.
