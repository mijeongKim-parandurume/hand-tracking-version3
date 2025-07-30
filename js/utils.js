// utils.js - 유틸리티 함수들

// 네임스페이스 생성
window.app = window.app || {};

// 초기화 시 모든 변수 확인
app.ensureInitialized = function() {
    if (!app.camera || !app.scene || !app.renderer || !app.world) {
        console.warn('Some app components are not properly initialized');
    }
};

// UI 업데이트 - 손 크기와 깊이 표시
app.updateDepthUI = function(handSize, zDepth) {
    const sizeElem = document.getElementById('handSizeValue');
    const depthElem = document.getElementById('zDepthValue');
    
    if (sizeElem && depthElem) {
        sizeElem.textContent = handSize ? handSize.toFixed(2) : '인식 중...';
        depthElem.textContent = zDepth ? zDepth.toFixed(2) : '인식 중...';
    }
};

// 손떨림 보정 초기화
app.initTremorReduction = function() {
    // 각 손에 대한 Z축 깊이 히스토리 초기화
    for (let h = 0; h < 2; h++) {
        app.zDepthHistory[h] = [];
        app.mcpDistanceHistory[h] = [];
        
        // 초기값으로 배열 채우기
        for (let i = 0; i < app.zDepthHistoryLength; i++) {
            app.zDepthHistory[h].push(0);
            app.mcpDistanceHistory[h].push(0);
        }
    }
};

// 손떨림 보정을 위한 저역 통과 필터
app.smoothValue = function(newValue, history, filteredValue, alpha = 0.3) {
    // 새 값을 히스토리에 추가
    history.push(newValue);
    
    // 히스토리 크기 제한
    if (history.length > app.zDepthHistoryLength) {
        history.shift();
    }
    
    // 간단한 저역 통과 필터 적용 (Exponential Moving Average)
    // alpha는 새 값의 가중치 (0에 가까울수록 더 부드럽지만 반응이 느림)
    filteredValue = alpha * newValue + (1 - alpha) * filteredValue;
    
    return filteredValue;
};
// utils.js에 추가
app.detectInspectGesture = function(landmarks, handIndex) {
    // 검지와 엄지만 펴고 나머지는 오므린 제스처 감지
    const thumbExtended = isFingerExtended(landmarks, 0); // 엄지
    const indexExtended = isFingerExtended(landmarks, 1); // 검지
    const middleClosed = !isFingerExtended(landmarks, 2); // 중지
    const ringClosed = !isFingerExtended(landmarks, 3); // 약지
    const pinkyClosed = !isFingerExtended(landmarks, 4); // 소지
    
    return thumbExtended && indexExtended && middleClosed && ringClosed && pinkyClosed;
};

// 손가락이 펴졌는지 확인하는 도우미 함수
function isFingerExtended(landmarks, fingerIndex) {
    // 손가락 관절 인덱스 매핑
    const fingerBase = [1, 5, 9, 13, 17]; // 각 손가락의 시작 관절
    const fingerMid = [2, 6, 10, 14, 18]; // 각 손가락의 중간 관절
    const fingerTip = [4, 8, 12, 16, 20]; // 각 손가락의 끝 관절
    
    const base = landmarks[fingerBase[fingerIndex]];
    const mid = landmarks[fingerMid[fingerIndex]];
    const tip = landmarks[fingerTip[fingerIndex]];
    
    // 손가락 각도 계산
    const v1 = new THREE.Vector3(mid.x - base.x, mid.y - base.y, mid.z - base.z);
    const v2 = new THREE.Vector3(tip.x - mid.x, tip.y - mid.y, tip.z - mid.z);
    
    // 각도 계산 (내적 사용)
    const dot = v1.dot(v2) / (v1.length() * v2.length());
    const angle = Math.acos(dot) * (180 / Math.PI);
    
    // 각도가 160도 이상이면 손가락이 펴진 것으로 판단
    return angle > 160;
}
app.toggleInspectMode = function(objectIndex) {
    app.isInspectMode = !app.isInspectMode;
    
    if (app.isInspectMode) {
        // 검사할 물체 저장
        app.inspectObject = app.objects[objectIndex];
        
        // 현재 카메라 위치 저장
        app.originalCameraPosition = app.camera.position.clone();
        
        // 물체 주변으로 카메라 이동
        const objPos = app.inspectObject.mesh.position.clone();
        const objSize = app.inspectObject.mesh.geometry.parameters.width;
        
        // 물체 크기에 따라 적절한 거리 계산
        const distance = objSize * 5;
        
        // 카메라 위치 계산 (물체 앞쪽에 배치)
        const newCameraPos = objPos.clone().add(new THREE.Vector3(0, objSize, distance));
        
        // 카메라 이동
        app.camera.position.copy(newCameraPos);
        app.camera.lookAt(objPos);
        
        console.log("검사 모드 시작");
    } else {
        // 원래 카메라 위치로 복원
        if (app.originalCameraPosition) {
            app.camera.position.copy(app.originalCameraPosition);
            app.camera.lookAt(new THREE.Vector3(0, 0, 0));
        }
        
        app.inspectObject = null;
        console.log("검사 모드 종료");
    }
};

// utils.js 파일에 손바닥 관련 유틸리티 함수 추가

// 손바닥 평면 계산 함수
app.calculatePalmPlane = function(handIndex, landmarks) {
    // 주요 랜드마크 위치 추출
    if (!app.fingerJoints || !app.fingerJoints[handIndex] || 
        app.fingerJoints[handIndex].length < 21) {
        console.warn("유효하지 않은 손 관절 데이터");
        // 기본값 반환
        return {
            center: new THREE.Vector3(),
            normal: new THREE.Vector3(0, 1, 0),
            width: 0.2,
            height: 0.2,
            wrist: new THREE.Vector3(),
            up: new THREE.Vector3(0, 1, 0)
        };
    }
    const wrist = new THREE.Vector3(
        app.fingerJoints[handIndex][0].position.x,
        app.fingerJoints[handIndex][0].position.y,
        app.fingerJoints[handIndex][0].position.z
    );
    
    const indexBase = new THREE.Vector3(
        app.fingerJoints[handIndex][5].position.x,
        app.fingerJoints[handIndex][5].position.y,
        app.fingerJoints[handIndex][5].position.z
    );
    
    const pinkyBase = new THREE.Vector3(
        app.fingerJoints[handIndex][17].position.x,
        app.fingerJoints[handIndex][17].position.y,
        app.fingerJoints[handIndex][17].position.z
    );
    
    const middleBase = new THREE.Vector3(
        app.fingerJoints[handIndex][9].position.x,
        app.fingerJoints[handIndex][9].position.y,
        app.fingerJoints[handIndex][9].position.z
    );
    
    // 손바닥 중심 계산 (MCP 관절들의 평균 위치)
    const palmCenter = new THREE.Vector3()
        .add(indexBase)
        .add(middleBase)
        .add(pinkyBase)
        .divideScalar(3);
    
    // 손바닥 법선 벡터 계산 (손바닥이 향하는 방향)
    const v1 = new THREE.Vector3().subVectors(indexBase, wrist);
    const v2 = new THREE.Vector3().subVectors(pinkyBase, wrist);
    const palmNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    
    // 손바닥 평면의 크기 계산 (손의 크기에 비례)
    const palmWidth = indexBase.distanceTo(pinkyBase);
    const palmHeight = Math.max(
        wrist.distanceTo(indexBase),
        wrist.distanceTo(middleBase),
        wrist.distanceTo(pinkyBase)
    );
    
    return {
        center: palmCenter,
        normal: palmNormal,
        width: palmWidth,
        height: palmHeight,
        wrist: wrist,
        // up 벡터는 손가락 방향 (손목에서 중지 MCP로의 방향)
        up: new THREE.Vector3().subVectors(middleBase, wrist).normalize()
    };
};

// 손바닥이 위를 향하고 있는지 확인하는 함수
app.isPalmUp = function(handIndex, landmarks) {
    // 손바닥 평면 계산
    const palmPlane = app.calculatePalmPlane(handIndex, landmarks);
    
    // 월드 상의 위쪽 방향 (Y축)과 손바닥 법선의 내적
    // 양수면 손바닥이 위쪽을 향하고 있음
    const worldUp = new THREE.Vector3(0, 1, 0);
    const dotProduct = palmPlane.normal.dot(worldUp);
    
    // 임계값 (0.3)보다 크면 손바닥이 위쪽을 향한다고 판단
    return dotProduct > 0.3;
};

// 물체가 손바닥 위에 있는지 확인하는 함수
app.isObjectOverPalm = function(objPosition, handIndex, landmarks) {
    // 손바닥 평면 계산
    const palmPlane = app.calculatePalmPlane(handIndex, landmarks);
    
    // 손바닥 중심에서 물체까지의 벡터
    const toCube = new THREE.Vector3().subVectors(objPosition, palmPlane.center);
    
    // 물체가 손바닥 평면으로부터의 거리 (법선 방향)
    const distanceToPalmPlane = toCube.dot(palmPlane.normal);
    
    // 손바닥 평면으로 물체 위치 투영
    const projectedPosition = new THREE.Vector3()
        .copy(objPosition)
        .sub(new THREE.Vector3().copy(palmPlane.normal).multiplyScalar(distanceToPalmPlane));
    
    // 투영된 위치가 손바닥 영역 내에 있는지 확인 (간단한 근사치)
    const toProjection = new THREE.Vector3().subVectors(projectedPosition, palmPlane.center);
    const distanceToCenter = toProjection.length();
    
    // 손바닥 영역의 반경 (손바닥 크기에 기반한 근사치)
    const palmRadius = Math.max(palmPlane.width, palmPlane.height) * 0.5;
    
    // 물체가 손바닥 평면 위에 있고 손바닥 영역 내에 있는지 확인
    const isAbovePalm = distanceToPalmPlane > 0 && distanceToPalmPlane < 0.3;
    const isWithinPalmArea = distanceToCenter < palmRadius;
    
    return isAbovePalm && isWithinPalmArea;
};

// 시각적 디버깅을 위한 손바닥 시각화 헬퍼 함수
app.visualizePalmPlane = function(handIndex, landmarks) {
    // 손바닥 평면 계산
    const palmPlane = app.calculatePalmPlane(handIndex, landmarks);
    
    // 기존 시각화 제거
    if (app.palmVisualizers && app.palmVisualizers[handIndex]) {
        app.scene.remove(app.palmVisualizers[handIndex]);
    }
    
    // 손바닥 평면 시각화 생성
    const palmSize = Math.max(palmPlane.width, palmPlane.height);
    const planeGeometry = new THREE.PlaneGeometry(palmSize, palmSize);
    
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: handIndex === 0 ? 0x88ff88 : 0x8888ff, // 왼손/오른손 다른 색상
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    
    // 평면의 위치와 방향 설정
    planeMesh.position.copy(palmPlane.center);
    
    // 평면의 법선이 손바닥 법선과 일치하도록 회전
    const worldNormal = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(worldNormal, palmPlane.normal);
    planeMesh.quaternion.copy(quaternion);
    
    // 씬에 추가
    app.scene.add(planeMesh);
    
    // 참조 저장
    if (!app.palmVisualizers) {
        app.palmVisualizers = [null, null];
    }
    app.palmVisualizers[handIndex] = planeMesh;
    
    return planeMesh;
};
app.safeHandLandmarks = function(handIndex, landmarksArray, multiHandedness) {
    if (!multiHandedness || multiHandedness.length <= handIndex) {
        return null;
    }
    
    const handedness = multiHandedness[handIndex].label;
    const h = handedness === "Left" ? 0 : 1; // 왼손=0, 오른손=1
    
    if (landmarksArray && landmarksArray.length > handIndex) {
        return {
            landmarks: landmarksArray[handIndex],
            handIndex: h
        };
    }
    
    return null;
};