// interactions.js - 상호작용 로직 (집기, 회전, 던지기 등)

// 연결선 위치 업데이트
app.updateConnections = function(handIndex) {
    app.handMeshes[handIndex].children.forEach(line => {
        if (line.userData && line.userData.startJoint !== undefined) {
            const startJoint = app.fingerJoints[handIndex][line.userData.startJoint];
            const endJoint = app.fingerJoints[handIndex][line.userData.endJoint];
            
            // 라인 지오메트리 업데이트
            const points = [startJoint.position, endJoint.position];
            line.geometry.dispose();
            line.geometry = new THREE.BufferGeometry().setFromPoints(points);
            line.visible = true;
        }
    });
};

// 손 속도 계산
app.updateHandVelocity = function(handIndex, handCenter) {
    // 가장 오래된 위치 제거하고 새 위치 추가
    app.handPositions[handIndex].shift();
    app.handPositions[handIndex].push(handCenter.clone());
    
    // 속도 계산 (가장 최근 위치와 가장 오래된 위치 사이의 차이)
    const newest = app.handPositions[handIndex][app.velocityHistoryLength - 1];
    const oldest = app.handPositions[handIndex][0];
    const velocity = new THREE.Vector3().subVectors(newest, oldest);
    
    // 속도 스케일링 (프레임 레이트에 따라 조정 필요)
    velocity.multiplyScalar(30 / app.velocityHistoryLength); // 30fps 기준
    
    // 속도 업데이트
    app.handVelocities[handIndex].copy(velocity);
};

// 객체 놓기/던지기
app.releaseObject = function(objectIndex, handIndex) {
    const object = app.objects[objectIndex];
    
    // 물리 속성 활성화
    object.body.type = CANNON.Body.DYNAMIC;
    
    // 자연스러운 움직임을 위한 댐핑 설정
    object.body.linearDamping = 0.3;
    object.body.angularDamping = 0.3;
    
    // 현재 위치 유지
    object.body.velocity.set(0, 0, 0);
    object.body.angularVelocity.set(0, 0, 0);
    
    // 중력 영향 설정
    object.body.mass = 1;
    
    // 손목 회전 상태 초기화 (추가된 부분)
    if (typeof app.resetWristRotation === 'function') {
        app.resetWristRotation(handIndex);
    }
};

// 객체 이동
app.moveObjectTo = function(objectIndex, position) {
    const object = app.objects[objectIndex];
    
    // 부드러운 이동을 위한 보간
    const lerpFactor = 0.3; // 이동 속도 조절 (0~1)
    
    // 현재 위치에서 목표 위치로 부드럽게 이동
    object.mesh.position.lerp(position, lerpFactor);
    
    // 물리 바디 업데이트
    object.body.position.copy(object.mesh.position);
    object.body.wakeUp();
};

// 두 손 사이의 방향 벡터 계산
app.calculateHandDirection = function(handCenter1, handCenter2) {
    return new THREE.Vector3().subVectors(handCenter2, handCenter1).normalize();
};

// 추가 변수 선언 (main.js에 추가)
app.isRotationMode = [false, false];
app.lastHandDirection = [null, null];
app.rotationStartQuaternion = [null, null];

// 단일 손 회전 기능 (interactions.js에 추가)
app.handleSingleHandRotation = function(handIndex, objectIndex) {
    const obj = app.objects[objectIndex];
    
    // 손목과 검지 끝 위치
    const wrist = app.fingerJoints[handIndex][0].position;
    const indexTip = app.fingerJoints[handIndex][8].position;
    
    // 방향 벡터 계산
    const direction = new THREE.Vector3().subVectors(indexTip, wrist).normalize();
    
    // 회전 시작
    if (!app.lastHandDirection[handIndex]) {
        app.lastHandDirection[handIndex] = direction.clone();
        app.rotationStartQuaternion[handIndex] = obj.mesh.quaternion.clone();
    }
    // 회전 계속
    else {
        // 이전 방향과 현재 방향 사이의 회전 계산
        const angle = app.lastHandDirection[handIndex].angleTo(direction);
        
        // 회전 축 계산
        const axis = new THREE.Vector3().crossVectors(
            app.lastHandDirection[handIndex], 
            direction
        ).normalize();
        
        // 작은 회전만 적용 (급격한 변화 방지)
        if (angle > 0.01 && angle < 0.2 && axis.length() > 0.1) {
            const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle * 2);
            
            // 현재 물체 회전에 추가 회전 적용
            obj.mesh.quaternion.multiplyQuaternions(rotationQuaternion, obj.mesh.quaternion);
            
            // 물리 엔진 업데이트
            obj.body.quaternion.copy(obj.mesh.quaternion);
        }
        
        // 현재 방향 저장
        app.lastHandDirection[handIndex].copy(direction);
    }
};
// interactions.js에 추가할 코드

// 손목 회전을 계산하는 함수
app.calculateWristRotation = function(handIndex, landmarks) {
    // 손목과 주요 관절점 위치 가져오기
    const wrist = landmarks[0];  // 손목 랜드마크
    const indexMCP = landmarks[5];  // 검지 MCP
    const middleMCP = landmarks[9];  // 중지 MCP
    const pinkyMCP = landmarks[17]; // 소지 MCP
    
    // 손바닥 평면 정의를 위한 벡터 계산
    // 손목에서 검지 MCP로의 벡터
    const wristToIndex = new THREE.Vector3(
        indexMCP.x - wrist.x,
        indexMCP.y - wrist.y,
        indexMCP.z - wrist.z
    ).normalize();
    
    // 손목에서 소지 MCP로의 벡터
    const wristToPinky = new THREE.Vector3(
        pinkyMCP.x - wrist.x,
        pinkyMCP.y - wrist.y,
        pinkyMCP.z - wrist.z
    ).normalize();
    
    // 손바닥 법선 벡터 (손바닥이 향하는 방향)
    // 왼손과 오른손에 따라 외적 순서 변경
    let palmNormal;
    if (handIndex === 0) {  // 왼손
        palmNormal = new THREE.Vector3().crossVectors(wristToPinky, wristToIndex).normalize();
    } else {  // 오른손
        palmNormal = new THREE.Vector3().crossVectors(wristToIndex, wristToPinky).normalize();
    }
    
    // 손가락 방향 벡터 (손목에서 중지 MCP로의 방향)
    const fingerDirection = new THREE.Vector3(
        middleMCP.x - wrist.x,
        middleMCP.y - wrist.y,
        middleMCP.z - wrist.z
    ).normalize();
    
    // 손목 회전 상태를 표현하는 쿼터니언 계산
    // 기준 방향은 Y축이 위쪽, Z축이 사용자 방향
    const baseUp = new THREE.Vector3(0, 1, 0);  // Y축
    const baseForward = new THREE.Vector3(0, 0, 1);  // Z축
    
    // 손바닥 법선과 Y축 사이의 회전
    const rotationToNormal = new THREE.Quaternion().setFromUnitVectors(baseUp, palmNormal);
    
    // 손가락 방향이 Z축과 정렬되도록 추가 회전
    // 임시 벡터에 첫 번째 회전 적용
    const tempFingerDir = fingerDirection.clone().applyQuaternion(rotationToNormal.clone().invert());
    // Z축으로 정렬하기 위한 회전 (XZ 평면상의 회전)
    tempFingerDir.y = 0;  // Y 성분 제거
    tempFingerDir.normalize();
    const rotationToFingerDir = new THREE.Quaternion().setFromUnitVectors(baseForward, tempFingerDir);
    
    // 두 회전을 결합 (먼저 손바닥 방향, 그 다음 손가락 방향)
    const finalRotation = rotationToFingerDir.clone().multiply(rotationToNormal);
    
    return finalRotation;
};
// 손목 회전 기록을 저장하는 변수
app.wristRotationHistory = [null, null];  // [왼손, 오른손]
app.initialObjectRotation = [null, null];  // [왼손, 오른손]

// 손목 회전 기반 물체 회전 함수
app.handleWristRotation = function(handIndex, objectIndex, landmarks) {
    const obj = app.objects[objectIndex];
    
    // 현재 손목 회전 계산
    const currentWristRotation = app.calculateWristRotation(handIndex, landmarks);
    
    // 초기 상태 저장 (회전 시작점)
    if (!app.wristRotationHistory[handIndex]) {
        app.wristRotationHistory[handIndex] = currentWristRotation.clone();
        app.initialObjectRotation[handIndex] = obj.mesh.quaternion.clone();
        return;
    }
    
    // 이전 손목 회전과 현재 손목 회전 사이의 델타 회전 계산
    // 이전 회전의 역을 현재 회전에 곱함
    const deltaRotation = currentWristRotation.clone().multiply(
        app.wristRotationHistory[handIndex].clone().invert()
    );
    
    // 회전 변화량 확인 (작은 변화는 무시하여 안정성 확보)
    const rotationAngle = 2 * Math.acos(Math.min(1, Math.abs(deltaRotation.w)));
    
    if (rotationAngle > 0.01 && rotationAngle < 0.3) {  // 미세한 변화 및 급격한 변화 필터링
        // 델타 회전을 물체에 적용
        // 손목 회전의 영향력 조정 (더 직관적인 회전을 위해)
        const enhancedDelta = new THREE.Quaternion(
            deltaRotation.x * 2.0,  // 회전 증폭
            deltaRotation.y * 2.0,
            deltaRotation.z * 2.0,
            deltaRotation.w
        ).normalize();
        
        // 현재 물체 회전에 델타 회전 적용
        obj.mesh.quaternion.multiplyQuaternions(enhancedDelta, obj.mesh.quaternion);
        
        // 물리 엔진 업데이트
        obj.body.quaternion.copy(obj.mesh.quaternion);
        
        console.log(`손 ${handIndex} 손목 회전 적용: ${rotationAngle.toFixed(4)}`);
    }
    
    // 현재 손목 회전 저장 (다음 프레임 비교용)
    app.wristRotationHistory[handIndex] = currentWristRotation.clone();
};

// interactions.js 파일의 맨 아래에 다음 코드를 추가합니다

// 손 조인트 위치를 이용해 로컬 좌표계를 계산하는 함수
app.calculateHandCoordinateSystem = function(landmarks) {
    // 주요 랜드마크 위치 가져오기
    const wrist = new THREE.Vector3(landmarks[0].x, landmarks[0].y, landmarks[0].z);
    const middleMCP = new THREE.Vector3(landmarks[9].x, landmarks[9].y, landmarks[9].z);
    const indexMCP = new THREE.Vector3(landmarks[5].x, landmarks[5].y, landmarks[5].z);
    const pinkyMCP = new THREE.Vector3(landmarks[17].x, landmarks[17].y, landmarks[17].z);

    // 손 좌표계의 축 계산
    // Y축 - 손목에서 중지 MCP까지의 벡터 (손가락 방향)
    const yAxis = new THREE.Vector3().subVectors(middleMCP, wrist).normalize();
    
    // X축 - 소지 MCP에서 검지 MCP까지의 벡터 (손 너비 방향)
    const xAxis = new THREE.Vector3().subVectors(indexMCP, pinkyMCP).normalize();
    
    // Z축 - X축과 Y축의 외적 (손바닥에서 손등 방향)
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    
    // X축 재계산 (Z축과 Y축이 정확히 수직이 되도록)
    const correctedXAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    
    // 로컬 좌표계 행렬 생성
    const coordinateSystem = new THREE.Matrix4();
    coordinateSystem.makeBasis(correctedXAxis, yAxis, zAxis);
    
    return {
        matrix: coordinateSystem,
        origin: wrist,
        xAxis: correctedXAxis,
        yAxis: yAxis,
        zAxis: zAxis
    };
};

// 손 좌표계에서 물체 좌표계로의 변환 행렬 계산
app.calculateObjectTransform = function(handCoordSystem) {
    // 물체가 손에 자연스럽게 위치할 수 있도록 오프셋 설정
    const objectOffset = new THREE.Vector3(0, 0.15, 0); // 손 앞쪽에 위치하도록 조정
    
    // 월드 좌표계에서의 물체 위치 계산
    const objectPosition = handCoordSystem.origin.clone().add(
        objectOffset.clone()
            .applyMatrix4(handCoordSystem.matrix)
    );
    
    // 변환 행렬 생성
    const transform = new THREE.Matrix4().copy(handCoordSystem.matrix);
    transform.setPosition(objectPosition);
    
    return transform;
};

// 물체 회전 상태를 초기화하는 함수
app.initWristRotation = function(handIndex, objectIndex, landmarks) {
    const obj = app.objects[objectIndex];
    
    // 현재 손 좌표계 계산
    const handCoordSystem = app.calculateHandCoordinateSystem(landmarks);
    app.handCoordSystems[handIndex] = handCoordSystem;
    
    // 초기 손 행렬 저장
    app.initialHandMatrices[handIndex] = handCoordSystem.matrix.clone();
    
    // 초기 물체 행렬 저장
    app.initialObjectMatrices[handIndex] = new THREE.Matrix4().compose(
        obj.mesh.position.clone(),
        obj.mesh.quaternion.clone(),
        obj.mesh.scale.clone()
    );
    
    // 물체와 손 사이의 오프셋 계산
    // 이것은 물체를 집었을 때 물체가 손에 상대적으로 어떤 위치에 있는지 결정
    const objMatrix = new THREE.Matrix4().copy(handCoordSystem.matrix).invert()
        .multiply(app.initialObjectMatrices[handIndex]);
    app.objectAttachOffsets[handIndex] = objMatrix;
    
    // 손목 위치 저장
    app.lastWristPositions[handIndex] = handCoordSystem.origin.clone();
    
    console.log(`손 ${handIndex} 물체 회전 초기화 완료`);
};

// 손목 회전에 따라 물체를 회전시키는 함수
app.updateObjectWithWristRotation = function(handIndex, objectIndex, landmarks) {
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 21) {
        console.warn("유효하지 않은 랜드마크 데이터");
        return;
    }
    
    if (!app.objects[objectIndex]) {
        console.warn("유효하지 않은 객체 인덱스:", objectIndex);
        return;
    }
    
    const obj = app.objects[objectIndex];
    
    try {
        // 현재 손 좌표계 계산
        const handCoordSystem = app.calculateHandCoordinateSystem(landmarks);
        
        // 초기 상태 저장 (회전 시작점)
        if (app.initialHandMatrices[handIndex] === null) {
            app.initWristRotation(handIndex, objectIndex, landmarks);
            return;
        }
        
        // 나머지 코드는 그대로...
    } catch (error) {
        console.error("손목 회전 처리 중 오류 발생:", error);
        // 오류 발생 시 회전 상태 초기화
        app.resetWristRotation(handIndex);
    }
};

// 물체 회전 상태 초기화
app.resetWristRotation = function(handIndex) {
    app.handCoordSystems[handIndex] = null;
    app.initialHandMatrices[handIndex] = null;
    app.initialObjectMatrices[handIndex] = null;
    app.objectAttachOffsets[handIndex] = null;
    app.lastWristPositions[handIndex] = null;
};

// interactions.js 파일에 손 회전을 큐브에 직접 적용하는 새로운 함수 추가

// 손의 방향에 따라 물체의 회전을 설정하는 함수
app.updateObjectRotationWithHand = function(handIndex, objectIndex, landmarks) {
    const obj = app.objects[objectIndex];
    
    // 손의 주요 랜드마크 참조
    const wrist = app.fingerJoints[handIndex][0].position;
    const indexMCP = app.fingerJoints[handIndex][5].position;
    const middleMCP = app.fingerJoints[handIndex][9].position;
    const pinkyMCP = app.fingerJoints[handIndex][17].position;
    
    // 1. 손 좌표계 계산
    // 손목에서 중지 MCP까지의 벡터 (Y축 - 손가락 방향)
    const handY = new THREE.Vector3().subVectors(middleMCP, wrist).normalize();
    
    // 오른손과 왼손에 대한 처리 방식 분리
    let handX, handZ;
    
    if (handIndex === 0) {  // 왼손
        // 검지 MCP에서 소지 MCP까지의 벡터 (X축 방향 - 손 너비 방향)
        handX = new THREE.Vector3().subVectors(indexMCP, pinkyMCP).normalize();
        // 손바닥 법선 벡터 (Z축 - 손바닥이 향하는 방향)
        handZ = new THREE.Vector3().crossVectors(handX, handY).normalize();
        // X축 수정 (직교성 보장)
        const correctedHandX = new THREE.Vector3().crossVectors(handY, handZ).normalize();
        handX = correctedHandX;
    } else {  // 오른손
        // 오른손의 경우 벡터 방향 반전
        handX = new THREE.Vector3().subVectors(pinkyMCP, indexMCP).normalize();
        // 오른손의 경우 외적 순서 반전 (왼손 법칙)
        handZ = new THREE.Vector3().crossVectors(handY, handX).normalize();
        // X축 수정 (직교성 보장)
        const correctedHandX = new THREE.Vector3().crossVectors(handZ, handY).normalize();
        handX = correctedHandX;
    }
    
    // 2. 손 방향에 따른 회전 행렬 생성
    const rotationMatrix = new THREE.Matrix4().makeBasis(
        handX, handY, handZ
    );
    
    // 3. 회전 행렬에서 쿼터니언 추출
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    // 4. 손 방향에 따라 큐브 회전을 조정해야 할 경우가 있음 (잡는 방식에 따라)
    if (app.holdType[handIndex] === 'pinch') {
        // 핀치 잡기에서는 손이 관여하는 방향 조절
        // 왼손과 오른손에 따라 다른 조정 적용
        const adjustment = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            handIndex === 0 ? Math.PI / 2 : -Math.PI / 2  // 왼손과 오른손에 반대 회전
        );
        targetQuaternion.multiply(adjustment);
    }
    
    // 5. 현재 회전과 목표 회전 사이를 부드럽게 보간
    const lerpFactor = 0.3; // 회전 속도 조절 (0~1)
    obj.mesh.quaternion.slerp(targetQuaternion, lerpFactor);
    
    // 6. 물리 바디의 회전도 업데이트
    obj.body.quaternion.copy(new CANNON.Quaternion(
        obj.mesh.quaternion.x, 
        obj.mesh.quaternion.y, 
        obj.mesh.quaternion.z, 
        obj.mesh.quaternion.w
    ));
};