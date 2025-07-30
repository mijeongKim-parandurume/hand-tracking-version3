// main.js - 메인 애플리케이션 진입점

// 전역 변수들을 window 객체로 공유
window.app = window.app || {};

// 전역 변수 초기화
app.camera = null;
app.scene = null;
app.renderer = null;
app.world = null;
app.objects = [];
app.fingerJoints = [[], []];
app.handMeshes = [null, null];
app.jointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
app.jointGeometry = new THREE.SphereGeometry(0.03, 32, 32);
app.connectionMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
app.isInspectMode = false;
app.inspectObject = null;
app.originalCameraPosition = null;
app.wristRotationHistory = [null, null];  // [왼손, 오른손]
app.initialObjectRotation = [null, null];  // [왼손, 오른손]
app.handCoordSystems = [null, null]; // [왼손, 오른손]
app.initialHandMatrices = [null, null]; // [왼손, 오른손] 
app.initialObjectMatrices = [null, null]; // [왼손, 오른손]
app.objectAttachOffsets = [null, null]; // [왼손, 오른손]
app.lastWristPositions = [null, null]; // [왼손, 오른손]
app.wristRotationEnabled = true; // 손목 회전 기능 활성화 여부 (필요시 토글 가능)
app.handMeshDebugLogged = false; // 디버그 로그 플래그
app.useSimpleLandmarks = false; // 단순 랜드마크 시각화 모드 (통합 메쉬 활성화)
app.useBasicLandmarks = true; // 기본 랜드마크 표시 모드 (원과 선) - 기본값
app.smoothHandMeshes = [null, null]; // 통합된 손 메쉬 배열 [왼손, 오른손]
// 손바닥 관련 상태 변수
app.handData = [
    {  // 왼손 (handIndex = 0)
        palmPlane: null,  // 손바닥 평면 정보
        isPalmUp: false,  // 손바닥이 위를 향하고 있는지
        lastUpdateTime: 0 // 마지막 업데이트 시간
    }, 
    {  // 오른손 (handIndex = 1)
        palmPlane: null,
        isPalmUp: false,
        lastUpdateTime: 0
    }
];
// 회전 모드 설정
app.useNaturalRotation = true; // 기본값: 손에 따라 자연스럽게 회전

// 손바닥 관련 상태 변수
app.objectsOnPalm = [null, null]; // 각 손바닥 위에 올려진 물체 [왼손, 오른손]
app.isPalmMode = [false, false]; // 손바닥 모드 활성화 상태 [왼손, 오른손]
app.palmVisualizers = [null, null]; // 손바닥 시각화 메시 [왼손, 오른손]
app.showPalmVisualizer = false; // 손바닥 시각화 표시 여부 (디버깅용)


// 상호작용 상태
app.isPinching = [false, false];
app.isHandClosed = [false, false];
app.isHolding = [false, false];
app.holdType = [null, null];
app.isResizing = false;
app.isRotating = false;
app.initialHandDistance = 0;
app.initialCubeScale = 1;
app.initialHandDirection = new THREE.Vector3();
app.initialCubeRotation = new THREE.Euler();

// 속도 추적
app.handPositions = [[], []];
app.handVelocities = [new THREE.Vector3(), new THREE.Vector3()];
app.velocityHistoryLength = 5;

// 손떨림 보정을 위한 변수
app.zDepthHistory = [[], []]; // 각 손에 대한 Z축 깊이 기록
app.filteredZDepth = [0, 0]; // 필터링된 Z축 깊이 값
app.zDepthHistoryLength = 10; // 기록할 이전 위치의 수
app.mcpDistanceHistory = [[], []]; // 각 손에 대한 MCP 거리 기록
app.filteredMcpDistance = [0, 0]; // 필터링된 MCP 거리

// 초기화 함수
function init() {
    app.initPhysics();
    app.initThree();
    app.initHandTracking();
    app.initTremorReduction(); // 손떨림 보정 초기화 추가

    // 내보내기 UI 추가
    if (typeof app.createExportUI === 'function') {
        app.createExportUI();
    }
}

// main.js의 onWindowResize 함수 수정
function onWindowResize() {
    if (app.isPerspective) {
        // 퍼스펙티브 카메라 업데이트
        app.camera.aspect = window.innerWidth / window.innerHeight;
    } else {
        // 직교 카메라 업데이트
        const aspectRatio = window.innerWidth / window.innerHeight;
        const viewSize = 3;
        app.camera.left = -viewSize * aspectRatio;
        app.camera.right = viewSize * aspectRatio;
        app.camera.top = viewSize;
        app.camera.bottom = -viewSize;
    }
    
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
}


// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    // 물리 세계 시뮬레이션 업데이트
    app.world.step(1/60);
    
    // Three.js 메시와 CANNON.js 물리 바디 동기화
    app.objects.forEach(object => {
        if (!object.isGrabbed) {
            object.mesh.position.copy(object.body.position);
            object.mesh.quaternion.copy(object.body.quaternion);
        } else {
            object.body.position.copy(object.mesh.position);
            object.body.quaternion.copy(object.mesh.quaternion);
        }
    });
    
    app.renderer.render(app.scene, app.camera);
}

// 페이지 로드 시 초기화
window.addEventListener('load', function() {
    init();
    window.addEventListener('resize', onWindowResize, false);
});

window.addEventListener('error', function(event) {
    console.error("Caught runtime error:", event.error);
    // Reset application state if needed
    // Prevent the error from crashing the app
    event.preventDefault();
});
// Add this to main.js
app.recoverFromError = function() {
    // Reset all interaction states
    for (let h = 0; h < 2; h++) {
        app.isHolding[h] = false;
        app.isPinching[h] = false;
        app.isHandClosed[h] = false;
        app.holdType[h] = null;
    }
    
    // Reset all objects
    app.objects.forEach(obj => {
        obj.grabbers = [false, false];
        obj.isGrabbed = false;
        obj.mesh.material.color.set(obj.originalColor);
        obj.twoHandGrab = false;
        obj.isBeingTransferred = false;
    });
    
    // Reset camera if in inspect mode
    if (app.isInspectMode) {
        app.isInspectMode = false;
        if (app.originalCameraPosition) {
            app.camera.position.copy(app.originalCameraPosition);
        }
    }
    
    console.log("Application state recovered");

    // 전역 에러 핸들러 강화
    window.addEventListener('error', function(event) {
        console.error("런타임 에러 발생:", event.error);
        // 특정 종류의 오류만 처리 (맥락에 따라 필터링)
        if (event.error && (
            event.error.message.includes("landmark") || 
            event.error.message.includes("hand") ||
            event.error.message.includes("mesh")
        )) {
            // 오류 관련 상태 복구
            app.recoverFromError();
        }
        // 기본 에러 동작 방지 (앱 크래시 방지)
        event.preventDefault();
    });

    // 심각한 오류 감지를 위한 정기적 상태 확인
    setInterval(function() {
        // 비정상 상태 확인 (예: 모든 물체가 뷰에서 벗어남)
        let isStateAbnormal = app.objects.every(obj => 
            Math.abs(obj.mesh.position.y) > 10 ||
            Math.abs(obj.mesh.position.x) > 10 ||
            Math.abs(obj.mesh.position.z) > 10
        );
        
        if (isStateAbnormal) {
            console.warn("비정상 상태 감지: 모든 물체가 화면 밖으로 이동");
            app.recoverFromError();
            // 물체 위치 초기화
            app.objects.forEach((obj, index) => {
                const offset = index * 0.5 - 0.5;
                obj.mesh.position.set(offset, 0, 0);
                obj.body.position.set(offset, 0, 0);
                obj.body.velocity.set(0, 0, 0);
                obj.body.angularVelocity.set(0, 0, 0);
            });
        }
    }, 5000); // 5초마다 확인
};
