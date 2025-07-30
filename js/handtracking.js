// handTracking.js - MediaPipe 핸드 트래킹 설정 및 처리

// MediaPipe Hands 초기화
app.initHandTracking = function() {
    const videoElement = document.getElementById('videoElement');
    
    // MediaPipe 핸즈 모델 설정
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
        }
    });
    
    hands.setOptions({
        selfieMode: true,
        maxNumHands: 2,
        modelComplexity: 1,
        // Increase confidence thresholds for more stability
        minDetectionConfidence: 0.6, // Increase from 0.5
        minTrackingConfidence: 0.6   // Increase from 0.5
    });

    // 결과 처리 함수
    hands.onResults(app.onHandsResults);

    // 카메라 초기화
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    camera.start().catch(error => {
        console.error("Camera start error:", error);
        // Show user-friendly error message
        alert("카메라를 시작할 수 없습니다. 카메라 권한을 확인해주세요.");
    });

    console.log("Webcam initialized and MediaPipe Hands started");
};

// 손 메쉬 업데이트 함수 - 랜드마크 기반 시각화
app.updateHandMesh = function(handIndex, landmarks) {
    if (!app.handMeshes3D[handIndex] || !app.handBonesMap[handIndex]) {
        return; // 모델이 아직 로드되지 않음
    }
    
    // 손 메쉬 표시/숨김 설정
    app.handMeshes3D[handIndex].visible = app.useMeshModels;
    
    // 향상된 랜드마크 모드 처리
    if (app.useSimpleLandmarks) {
        app.createSimpleLandmarkHand(handIndex, landmarks);
        return;
    }
    
    // 기본 랜드마크 모드 처리 (원과 선)
    if (app.useBasicLandmarks) {
        app.createBasicLandmarks(handIndex, landmarks);
        return;
    }
    
    // 메쉬 모델을 사용하지 않는 경우 기본 랜드마크 표시
    if (!app.useMeshModels) {
        // 기존 랜드마크 표시 (관절과 연결선)
        app.fingerJoints[handIndex].forEach(joint => {
            joint.visible = true;
            joint.scale.setScalar(1.0); // 기본 크기로 리셋
            joint.material.color.setHex(0xffffff); // 기본 색상으로 리셋
        });
        
        app.handMeshes[handIndex].children.forEach(line => {
            line.visible = true;
            line.material.color.setHex(0xffffff); // 기본 색상으로 리셋
        });
        return;
    }
    
    // 기존 랜드마크 숨기기
    app.fingerJoints[handIndex].forEach(joint => {
        joint.visible = false;
    });
    
    app.handMeshes[handIndex].children.forEach(line => {
        line.visible = false;
    });
    
    // === 랜드마크 기반 3D 손 모델 업데이트 ===
    // 복잡한 본 애니메이션 대신 각 랜드마크 위치에 3D 모델의 해당 부분을 직접 배치
    
    // 손 위치를 손목 위치로 설정 (바닥 위치 고려)
    const wristLandmark = landmarks[0];
    const x = (wristLandmark.x - 0.5) * 2;
    const y = (1.0 - wristLandmark.y) * 3.0 - 1.5; // 카메라 좌표를 바닥 기준 3D 좌표로 변환
    const z = app.fingerJoints[handIndex][0].position.z;
    
    app.handMeshes3D[handIndex].position.set(x, y, z);
    
    // 오프셋 적용
    app.handMeshes3D[handIndex].position.x += app.meshOffsetX;
    app.handMeshes3D[handIndex].position.y += app.meshOffsetY;
    app.handMeshes3D[handIndex].position.z += app.meshOffsetZ;
    
    // 전체 손 메쉬 기본 회전 (손바닥이 카메라를 향하도록)
    app.handMeshes3D[handIndex].rotation.x = Math.PI / 2;
    app.handMeshes3D[handIndex].rotation.y = 0;
    app.handMeshes3D[handIndex].rotation.z = 0;
    
    // === 단순화된 랜드마크 매칭 ===
    // 3D 모델의 각 부분을 MediaPipe 랜드마크 위치에 직접 매칭
    const bonesMap = app.handBonesMap[handIndex];
    const boneNames = app.landmarkToGLTFBone;
    const joints = app.fingerJoints[handIndex];

    // 디버깅용 로그 (처음 한 번만)
    if (!app.handMeshDebugLogged) {
        app.handMeshDebugLogged = true;
        console.log(`손 ${handIndex} 본 매핑 상태:`, Object.keys(bonesMap));
        console.log(`예상 본 이름:`, boneNames);
        console.log("단순화된 랜드마크 매칭 모드 활성화");
    }

    // 각 랜드마크에 대해 직접 위치 매칭 (회전 계산 없이)
    for (let i = 0; i < boneNames.length && i < landmarks.length; i++) {
        const boneName = boneNames[i];
        const bone = bonesMap[boneName];
        if (!bone || !joints[i]) continue;

        // MediaPipe 랜드마크 위치를 3D 모델 좌표계로 직접 변환
        const landmark = landmarks[i];
        const wrist = landmarks[0];
        
        // 손목을 기준으로 한 상대 위치 계산
        const relX = (landmark.x - wrist.x) * 2;
        const relY = -(landmark.y - wrist.y) * 3.0; // y축 스케일을 3.0으로 증가하여 더 넓은 범위 매핑
        const relZ = (landmark.z - wrist.z) * 1.5;
        
        // 본 위치를 랜드마크 위치에 직접 설정 (회전 없이)
        if (i === 0) { // 손목본은 원점
            bone.position.set(0, 0, 0);
        } else {
            // 랜드마크 위치에 직접 매칭 (스케일 조정)
            bone.position.set(relX * 0.5, relY * 0.5, relZ * 0.5);
        }
        
        // 회전은 기본값으로 유지 (자연스러운 손 모양 유지)
        bone.quaternion.set(0, 0, 0, 1); // 기본 회전
    }
};

// 완전히 새로운 부드러운 손 모델 - 이미지와 같은 스타일
app.createSimpleLandmarkHand = function(handIndex, landmarks) {
    // 이전 잔상 제거
    app.clearSingleHandRemnants(handIndex);
    
    // 기존 3D 모델 숨기기
    if (app.handMeshes3D[handIndex]) {
        app.handMeshes3D[handIndex].visible = false;
    }
    
    // 새로운 사실적인 손 모델 생성
    app.createRealisticHand(handIndex, landmarks);
    
    // 관절(랜드마크) 숨기기 - 메쉬만 표시
    for (let i = 0; i < landmarks.length && i < app.fingerJoints[handIndex].length; i++) {
        const joint = app.fingerJoints[handIndex][i];
        joint.visible = false; // 모든 관절 점을 숨김
    }
    
    // 연결선도 숨기기 - 깔끔한 메쉬 표시
    app.handMeshes[handIndex].children.forEach((line, index) => {
        line.visible = false; // 모든 연결선 숨김
    });
};

// 기본 랜드마크 표시 함수 (원과 선)
app.createBasicLandmarks = function(handIndex, landmarks) {
    // 향상된 랜드마크 잔상 제거
    app.clearSingleHandRemnants(handIndex);
    
    // 기존 3D 모델 숨기기
    if (app.handMeshes3D[handIndex]) {
        app.handMeshes3D[handIndex].visible = false;
    }
    
    // 관절(랜드마크) 표시 - 원형
    for (let i = 0; i < landmarks.length && i < app.fingerJoints[handIndex].length; i++) {
        const joint = app.fingerJoints[handIndex][i];
        joint.visible = true; // 모든 관절 점을 표시
        joint.scale.setScalar(1.0); // 기본 크기
        joint.material.color.setHex(0xffffff); // 흰색
    }
    
    // 연결선 표시
    app.handMeshes[handIndex].children.forEach((line, index) => {
        line.visible = true; // 모든 연결선 표시
        line.material.color.setHex(0xffffff); // 흰색
    });
};

// 손바닥 메쉬 생성 함수 (완전히 개선된 버전)
app.createPalmMesh = function(handIndex, landmarks) {
    const scene = app.scene;
    
    // 기존 손바닥 메쉬 제거
    if (app.palmMeshes && app.palmMeshes[handIndex]) {
        scene.remove(app.palmMeshes[handIndex]);
    }
    
    if (!app.palmMeshes) app.palmMeshes = [];
    
    // 손바닥의 핵심 포인트들을 3D 좌표로 변환 (바닥 위치와 깊이 고려)
    const getPoint3D = (landmark) => {
        return new THREE.Vector3(
            (landmark.x - 0.5) * 2,
            (1.0 - landmark.y) * 3.0 - 1.5, // 카메라 좌표를 바닥 기준 3D 좌표로 변환
            app.fingerJoints[handIndex][0].position.z + landmark.z * 0.3 // MediaPipe z값으로 깊이 설정
        );
    };
    
    const wrist = getPoint3D(landmarks[0]);
    const thumbBase = getPoint3D(landmarks[1]);
    const indexBase = getPoint3D(landmarks[5]);
    const middleBase = getPoint3D(landmarks[9]);
    const ringBase = getPoint3D(landmarks[13]);
    const pinkyBase = getPoint3D(landmarks[17]);
    
    // 더 정교한 손바닥 형태를 위한 BufferGeometry 생성
    const vertices = [];
    const indices = [];
    const normals = [];
    
    // 손바닥의 메인 정점들 (더 자연스러운 순서로)
    const palmVertices = [
        wrist,       // 0: 손목
        pinkyBase,   // 1: 소지 베이스  
        ringBase,    // 2: 약지 베이스
        middleBase,  // 3: 중지 베이스
        indexBase,   // 4: 검지 베이스
        thumbBase    // 5: 엄지 베이스
    ];
    
    // 손바닥 중심점을 좀 더 정확하게 계산 (엄지 제외하고 계산)
    const palmCenter = new THREE.Vector3();
    for (let i = 1; i < 5; i++) { // 엄지 제외하고 다른 4개 손가락 베이스 사용
        palmCenter.add(palmVertices[i]);
    }
    palmCenter.divideScalar(4);
    palmCenter.add(wrist);
    palmCenter.divideScalar(2); // 손목과 중간값
    
    // 정점 데이터 구성
    palmVertices.forEach(vertex => {
        vertices.push(vertex.x, vertex.y, vertex.z);
    });
    vertices.push(palmCenter.x, palmCenter.y, palmCenter.z); // 중심점 추가
    
    // 삼각형 인덱스 생성 (중심점에서 방사형으로)
    const centerIndex = palmVertices.length;
    for (let i = 0; i < palmVertices.length; i++) {
        const nextIndex = (i + 1) % palmVertices.length;
        indices.push(centerIndex, i, nextIndex);
    }
    
    // 손바닥 뒷면도 생성 (더 현실적인 두께)
    const backOffset = -0.015; // 두께를 줄여서 더 자연스럽게
    palmVertices.forEach(vertex => {
        vertices.push(vertex.x, vertex.y, vertex.z + backOffset);
    });
    vertices.push(palmCenter.x, palmCenter.y, palmCenter.z + backOffset);
    
    // 뒷면 삼각형 (시계 반대 방향)
    const backCenterIndex = palmVertices.length * 2;
    for (let i = 0; i < palmVertices.length; i++) {
        const nextIndex = (i + 1) % palmVertices.length;
        indices.push(backCenterIndex, palmVertices.length + nextIndex, palmVertices.length + i);
    }
    
    // 측면 연결 (앞면과 뒷면 연결)
    for (let i = 0; i < palmVertices.length; i++) {
        const nextIndex = (i + 1) % palmVertices.length;
        const frontCurrent = i;
        const frontNext = nextIndex;
        const backCurrent = palmVertices.length + i;
        const backNext = palmVertices.length + nextIndex;
        
        // 측면 사각형을 2개의 삼각형으로
        indices.push(frontCurrent, backCurrent, frontNext);
        indices.push(frontNext, backCurrent, backNext);
    }
    
    // 지오메트리 생성
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // 더 사실적인 손바닥 피부색과 재질
    const material = new THREE.MeshPhongMaterial({
        color: 0xffdbac, // 기본 피부색을 더 자연스럽게
        shininess: 5,    // 광택을 크게 줄여서 자연스럽게
        specular: 0x666666, // 반사광을 좀 더 강하게
        side: THREE.DoubleSide,
        flatShading: false // 부드러운 쉐이딩
    });
    
    // 손바닥에 약간의 색상 변화 추가 (더 현실적으로)
    material.color.offsetHSL(0.01, 0.05, 0.02);
    
    const palmMesh = new THREE.Mesh(geometry, material);
    palmMesh.castShadow = true;
    palmMesh.receiveShadow = true;
    
    app.palmMeshes[handIndex] = palmMesh;
    scene.add(palmMesh);
};

// 손가락 세그먼트 생성 함수 (그림자 지원 개선)
app.createFingerSegments = function(handIndex, landmarks) {
    const scene = app.scene;
    
    // 기존 손가락 세그먼트 제거
    if (app.fingerSegments && app.fingerSegments[handIndex]) {
        app.fingerSegments[handIndex].forEach(segment => {
            scene.remove(segment);
        });
    }
    
    if (!app.fingerSegments) app.fingerSegments = [[], []];
    app.fingerSegments[handIndex] = [];
    
    // 손가락 세그먼트 정의 (시작점, 끝점)
    const fingerSegments = [
        // 엄지 - 손바닥에서 시작
        [[0, 1], [1, 2], [2, 3], [3, 4]],
        // 검지 - 손바닥에서 시작
        [[0, 5], [5, 6], [6, 7], [7, 8]],
        // 중지 - 손바닥에서 시작
        [[0, 9], [9, 10], [10, 11], [11, 12]],
        // 약지 - 손바닥에서 시작
        [[0, 13], [13, 14], [14, 15], [15, 16]],
        // 소지 - 손바닥에서 시작
        [[0, 17], [17, 18], [18, 19], [19, 20]]
    ];
    
    // 더 자연스러운 피부색 그라데이션
    const fingerColors = [
        0xffdbac, // 엄지 - 기본 피부색
        0xffe0b5, // 검지 - 약간 밝은 피부색
        0xffdead, // 중지 - 조금 더 어두운 피부색
        0xffd7a8, // 약지 - 약간 어두운 피부색
        0xffe4b8  // 소지 - 가장 밝은 피부색
    ];
    
    fingerSegments.forEach((finger, fingerIndex) => {
        finger.forEach(([startIdx, endIdx], segmentIdx) => {
            const startLandmark = landmarks[startIdx];
            const endLandmark = landmarks[endIdx];
            
            // 3D 좌표 변환 (바닥 위치와 깊이 고려)
            const start = new THREE.Vector3(
                (startLandmark.x - 0.5) * 2,
                (1.0 - startLandmark.y) * 3.0 - 1.5, // 카메라 좌표를 바닥 기준 3D 좌표로 변환
                app.fingerJoints[handIndex][0].position.z + startLandmark.z * 0.3 // MediaPipe z값으로 깊이 설정
            );
            
            const end = new THREE.Vector3(
                (endLandmark.x - 0.5) * 2,
                (1.0 - endLandmark.y) * 3.0 - 1.5, // 카메라 좌표를 바닥 기준 3D 좌표로 변환
                app.fingerJoints[handIndex][0].position.z + endLandmark.z * 0.3 // MediaPipe z값으로 깊이 설정
            );
            
            // 원통형 지오메트리 생성 (더 세밀하고 현실적으로)
            const length = start.distanceTo(end);
            let radius = 0.018; // 기본 손가락 굵기를 약간 줄임
            
            // 손가락별 굵기 조정 (더 현실적으로)
            if (fingerIndex === 0) {
                // 엄지는 더 굵고 길이에 따라 변화
                radius = segmentIdx === 0 ? 0.028 : (segmentIdx === 1 ? 0.025 : 0.022);
            } else if (fingerIndex === 1) {
                // 검지는 중간 굵기
                radius = segmentIdx === 0 ? 0.022 : (segmentIdx === 1 ? 0.020 : 0.018);
            } else if (fingerIndex === 2) {
                // 중지는 가장 긴 손가락
                radius = segmentIdx === 0 ? 0.024 : (segmentIdx === 1 ? 0.021 : 0.019);
            } else if (fingerIndex === 3) {
                // 약지는 중지보다 약간 가늘게
                radius = segmentIdx === 0 ? 0.021 : (segmentIdx === 1 ? 0.019 : 0.017);
            } else if (fingerIndex === 4) {
                // 소지는 가장 가늘게
                radius = segmentIdx === 0 ? 0.018 : (segmentIdx === 1 ? 0.016 : 0.014);
            }
            
            // 손가락 끝으로 갈수록 자연스럽게 가늘어지게
            const taperFactor = segmentIdx === (finger.length - 1) ? 0.7 : 0.95;
            
            // 더 둥근 원통 생성 (세그먼트 수 증가)
            const geometry = new THREE.CylinderGeometry(
                radius * taperFactor, radius, length, 16, 1 // 세그먼트를 16으로 증가
            );
            
            // 더 사실적인 피부 재질 (광택과 거칠기 조정)
            const material = new THREE.MeshPhongMaterial({
                color: fingerColors[fingerIndex],
                transparent: false,
                opacity: 1.0,
                shininess: 8, // 광택을 줄여서 더 자연스럽게
                specular: 0x444444, // 반사광을 좀 더 강하게
                flatShading: false, // 부드러운 쉐이딩
            });
            
            // 손가락 끝에는 약간 다른 색상 적용 (더 분홍빛)
            if (segmentIdx === finger.length - 1) {
                const tipColor = new THREE.Color(fingerColors[fingerIndex]);
                tipColor.offsetHSL(0.02, 0.1, 0.05); // 약간 분홍빛과 밝기 추가
                material.color = tipColor;
            }
            
            const cylinder = new THREE.Mesh(geometry, material);
            cylinder.castShadow = true;
            cylinder.receiveShadow = true;
            
            // 원통을 두 점 사이에 배치 및 회전
            const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            cylinder.position.copy(midPoint);
            
            // 관절 부분에 약간의 부풀림 추가 (더 현실적으로)
            if (segmentIdx === 0) { // 첫 번째 세그먼트 (베이스)
                const jointGeometry = new THREE.SphereGeometry(radius * 1.1, 12, 8);
                const jointMaterial = new THREE.MeshPhongMaterial({
                    color: fingerColors[fingerIndex],
                    shininess: 8,
                    specular: 0x444444,
                });
                
                const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                joint.position.copy(start);
                joint.castShadow = true;
                joint.receiveShadow = true;
                
                app.fingerSegments[handIndex].push(joint);
                scene.add(joint);
            }
            
            const direction = new THREE.Vector3().subVectors(end, start).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            cylinder.lookAt(midPoint.clone().add(direction));
            cylinder.rotateX(Math.PI / 2);
            
            app.fingerSegments[handIndex].push(cylinder);
            scene.add(cylinder);
            
            // 손가락 끝에 손톱 추가 (더 현실적으로)
            if (endIdx === 4 || endIdx === 8 || endIdx === 12 || endIdx === 16 || endIdx === 20) {
                const nailGeometry = new THREE.SphereGeometry(radius * 0.4, 8, 6);
                const nailMaterial = new THREE.MeshPhongMaterial({
                    color: 0xffe6d9, // 손톱 색상 (약간 분홍빛 흰색)
                    shininess: 25,   // 손톱은 약간 광택이 있음
                    specular: 0x888888,
                    transparent: true,
                    opacity: 0.9
                });
                
                const nail = new THREE.Mesh(nailGeometry, nailMaterial);
                nail.position.copy(end);
                nail.castShadow = true;
                nail.receiveShadow = true;
                
                app.fingerSegments[handIndex].push(nail);
                scene.add(nail);
            }
        });
    });
};

// 향상된 랜드마크 잔상 제거 함수
app.clearEnhancedLandmarkRemnants = function() {
    // 통합된 손 메쉬 제거
    if (app.smoothHandMeshes) {
        for (let h = 0; h < 2; h++) {
            if (app.smoothHandMeshes[h]) {
                app.scene.remove(app.smoothHandMeshes[h]);
                // 메모리 정리
                if (app.smoothHandMeshes[h].isMesh) {
                    app.smoothHandMeshes[h].geometry.dispose();
                    app.smoothHandMeshes[h].material.dispose();
                } else if (app.smoothHandMeshes[h].traverse) {
                    app.smoothHandMeshes[h].traverse(child => {
                        if (child.isMesh) {
                            child.geometry.dispose();
                            child.material.dispose();
                        }
                    });
                }
                app.smoothHandMeshes[h] = null;
            }
        }
    }
};

// 개별 손의 향상된 랜드마크 잔상 제거 함수
app.clearSingleHandRemnants = function(handIndex) {
    // 통합된 손 메쉬 제거
    if (app.smoothHandMeshes && app.smoothHandMeshes[handIndex]) {
        app.scene.remove(app.smoothHandMeshes[handIndex]);
        // 메모리 정리
        if (app.smoothHandMeshes[handIndex].isMesh) {
            app.smoothHandMeshes[handIndex].geometry.dispose();
            app.smoothHandMeshes[handIndex].material.dispose();
        } else if (app.smoothHandMeshes[handIndex].traverse) {
            app.smoothHandMeshes[handIndex].traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }
        app.smoothHandMeshes[handIndex] = null;
    }
};

// 사실적인 3D 손 메쉬 생성 시스템 (통합 메쉬)
app.createRealisticHand = function(handIndex, landmarks) {
    const scene = app.scene;
    
    // 기존 손 메쉬 그룹 제거
    if (app.smoothHandMeshes && app.smoothHandMeshes[handIndex]) {
        scene.remove(app.smoothHandMeshes[handIndex]);
        app.smoothHandMeshes[handIndex].traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
    
    if (!app.smoothHandMeshes) app.smoothHandMeshes = [null, null];
    
    // 랜드마크를 3D 좌표로 변환
    const points3D = landmarks.map(landmark => {
        return new THREE.Vector3(
            (landmark.x - 0.5) * 2,
            (1.0 - landmark.y) * 3.0 - 1.5,
            app.fingerJoints[handIndex][0].position.z + landmark.z * 0.3
        );
    });
    
    // 통합된 손 메쉬 생성
    const handMesh = app.createUnifiedHandMesh(points3D);
    
    // 그룹을 씬에 추가
    app.smoothHandMeshes[handIndex] = handMesh;
    scene.add(handMesh);
    
    return handMesh;
};

// 통합된 단일 손 메쉬 생성
app.createUnifiedHandMesh = function(points3D) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    
    const radialSegments = 8; // 관절의 원형 세그먼트 수
    const fingerDefs = {
        thumb:  { indices: [1, 2, 3, 4],    radius: 0.016 },
        index:  { indices: [5, 6, 7, 8],    radius: 0.012 },
        middle: { indices: [9, 10, 11, 12], radius: 0.013 },
        ring:   { indices: [13, 14, 15, 16],radius: 0.011 },
        pinky:  { indices: [17, 18, 19, 20],radius: 0.010 }
    };

    const fingerVertexMap = new Map();
    let vertexOffset = 0;

    // 1. 손가락 지오메트리 생성
    for (const fingerName in fingerDefs) {
        const finger = fingerDefs[fingerName];
        const rings = [];

        for (let i = 0; i < finger.indices.length; i++) {
            const point = points3D[finger.indices[i]];
            const radius = finger.radius * (1 - (i / (finger.indices.length * 1.5)));
            
            const boneDir = (i > 0) 
                ? new THREE.Vector3().subVectors(point, points3D[finger.indices[i-1]]).normalize()
                : new THREE.Vector3().subVectors(points3D[finger.indices[i+1]], point).normalize();
            
            const up = Math.abs(boneDir.y) > 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
            const right = new THREE.Vector3().crossVectors(boneDir, up).normalize();
            const perp = new THREE.Vector3().crossVectors(right, boneDir).normalize();
            
            const ring = [];
            for (let j = 0; j < radialSegments; j++) {
                const angle = (j / radialSegments) * Math.PI * 2;
                const v = new THREE.Vector3()
                    .copy(point)
                    .addScaledVector(right, radius * Math.cos(angle))
                    .addScaledVector(perp, radius * Math.sin(angle));
                
                vertices.push(v.x, v.y, v.z);
                ring.push(vertexOffset++);
            }
            rings.push(ring);
        }
        fingerVertexMap.set(fingerName, rings);

        // 손가락 튜브 연결
        for (let i = 0; i < rings.length - 1; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const next_j = (j + 1) % radialSegments;
                indices.push(rings[i][j], rings[i+1][j], rings[i][next_j]);
                indices.push(rings[i+1][j], rings[i+1][next_j], rings[i][next_j]);
            }
        }

        // 손가락 끝 마감
        const tipRing = rings[rings.length - 1];
        const tipPoint = points3D[finger.indices[finger.indices.length - 1]];
        const tipDir = new THREE.Vector3().subVectors(tipPoint, points3D[finger.indices[finger.indices.length - 2]]).normalize();
        const tipVertex = new THREE.Vector3().copy(tipPoint).addScaledVector(tipDir, finger.radius * 0.5);
        
        vertices.push(tipVertex.x, tipVertex.y, tipVertex.z);
        const tipIndex = vertexOffset++;
        for (let j = 0; j < radialSegments; j++) {
            indices.push(tipRing[j], tipIndex, tipRing[(j + 1) % radialSegments]);
        }
    }

    // 2. 손바닥 및 연결부 생성
    const palmPoints = {
        wrist: points3D[0],
        thumb: points3D[1],
        index: points3D[5],
        middle: points3D[9],
        ring: points3D[13],
        pinky: points3D[17]
    };

    // 손바닥 중심점 계산
    const palmCenter = new THREE.Vector3();
    palmCenter.add(palmPoints.index).add(palmPoints.middle).add(palmPoints.ring).add(palmPoints.pinky);
    palmCenter.divideScalar(4);

    // 손바닥 정점들 생성
    const palmVertices = [];
    const palmRadius = 0.03;
    
    // 각 손가락 베이스 주변에 손바닥 정점 생성
    [palmPoints.wrist, palmPoints.thumb, palmPoints.index, palmPoints.middle, palmPoints.ring, palmPoints.pinky, palmCenter].forEach(point => {
        vertices.push(point.x, point.y, point.z);
        palmVertices.push(vertexOffset++);
    });

    // 손바닥 삼각형 생성 (중심점에서 방사형으로)
    const centerIdx = palmVertices[6];
    for (let i = 0; i < 6; i++) {
        const nextIdx = (i + 1) % 6;
        indices.push(centerIdx, palmVertices[i], palmVertices[nextIdx]);
    }

    // 손가락 베이스와 손바닥 연결
    const fingerBaseRings = [
        fingerVertexMap.get('thumb')[0],
        fingerVertexMap.get('index')[0],
        fingerVertexMap.get('middle')[0],
        fingerVertexMap.get('ring')[0],
        fingerVertexMap.get('pinky')[0]
    ];

    // 각 손가락 베이스와 손바닥 연결
    fingerBaseRings.forEach((ring, i) => {
        if (ring && ring.length >= 4) {
            const palmIdx = palmVertices[i + 1]; // 손목 제외하고 시작
            // 손바닥과 손가락 베이스 연결
            for (let j = 0; j < ring.length; j++) {
                const nextJ = (j + 1) % ring.length;
                indices.push(palmIdx, ring[j], ring[nextJ]);
            }
        }
    });

    // 지오메트리 설정
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // 이미지와 유사한 재질
    const material = new THREE.MeshStandardMaterial({
        color: 0xdbe0e5, // 이미지에서 추출한 밝은 회색-파랑
        roughness: 0.7,
        metalness: 0.2,
    });
    
    const handMesh = new THREE.Mesh(geometry, material);
    handMesh.castShadow = true;
    handMesh.receiveShadow = true;
    
    return handMesh;
};

// 손 트래킹 결과 처리
app.onHandsResults = function(results) {
    try {
        // 1. 초기화 및 가시성 설정
        for (let h = 0; h < 2; h++) {
            // 관절 숨기기
            if (app.fingerJoints[h]) {
                app.fingerJoints[h].forEach(joint => {
                    if (joint) joint.visible = false;
                });
            }
            
            // 연결선 숨기기
            if (app.handMeshes[h] && app.handMeshes[h].children) {
                app.handMeshes[h].children.forEach(line => {
                    if (line) line.visible = false;
                });
            }
            
            // 3D 손 메쉬 숨기기
            if (app.handMeshes3D && app.handMeshes3D[h]) {
                app.handMeshes3D[h].visible = false;
            }
        }
        
        // 향상된 랜드마크 잔상 초기화 (매 프레임마다)
        app.clearEnhancedLandmarkRemnants();
        
        // 2. 손이 감지되지 않은 경우 모든 상태 초기화
        if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            console.log("손이 감지되지 않음");
            
            // 향상된 랜드마크 잔상 제거
            app.clearEnhancedLandmarkRemnants();
            
            // 손이 감지되지 않을 때 모든 상태 초기화
            for (let h = 0; h < 2; h++) {
                app.isHolding[h] = false;
                app.isPinching[h] = false;
                app.isHandClosed[h] = false;
                app.holdType[h] = null;
            }
            app.isResizing = false;
            app.isRotating = false;
            
            // 물체 grabbers 초기화
            app.objects.forEach(obj => {
                obj.grabbers = [false, false];
                if (obj.isGrabbed) {
                    obj.isGrabbed = false;
                    obj.mesh.material.color.set(obj.originalColor);
                    obj.twoHandGrab = false;
                    obj.isBeingTransferred = false;
                    obj.initialTwoHandGrab = false;
                }
            });
            
            // UI 업데이트
            app.updateDepthUI(null, null);
            return;
        }
        
        // 3. 손이 감지된 경우 처리 시작
        // 각 손에 대한 데이터 저장 배열
        const handCenters = [];  // 손 중심점
        const handIndices = [];  // 손 인덱스 (왼손=0, 오른손=1)
        const storedLandmarks = []; // 각 손의 랜드마크 데이터
        const detectedHands = [false, false]; // 현재 프레임에서 감지된 손 추적
        
        // 4. 각 감지된 손에 대한 처리
        for (let handIdx = 0; handIdx < results.multiHandLandmarks.length; handIdx++) {
            try {
                // 기본 손 데이터 추출
                const landmarks = results.multiHandLandmarks[handIdx];
                const handedness = results.multiHandedness[handIdx].label; // "Left" 또는 "Right"
                const h = handedness === "Left" ? 0 : 1; // 왼손=0, 오른손=1
                
                // 데이터 저장
                handIndices.push(h);
                storedLandmarks.push(landmarks);
                detectedHands[h] = true; // 이 손이 감지되었음을 표시
                
                // 5. 관절 위치 업데이트 (바닥에 맞춘 좌표 매핑)
                for (let i = 0; i < landmarks.length && i < app.fingerJoints[h].length; i++) {
                    const landmark = landmarks[i];
                    // Three.js 좌표계로 변환 (바닥 위치 고려)
                    const x = (landmark.x - 0.5) * 2;
                    // y 좌표 매핑: 카메라 하단(y=1.0)을 바닥(-1.5)에, 상단(y=0.0)을 상공(1.5)에 매핑
                    const y = (1.0 - landmark.y) * 3.0 - 1.5; // 카메라 좌표를 3D 공간 좌표로 변환
                    
                    app.fingerJoints[h][i].position.x = x;
                    app.fingerJoints[h][i].position.y = y;
                    app.fingerJoints[h][i].visible = true;
                }
                
                // 6. Z축 깊이 계산 및 설정
                // 주요 MCP 관절 참조
                const indexBase = landmarks[9];   // 검지 MCP
                const middleBase = landmarks[13]; // 중지 MCP
                const ringBase = landmarks[17];   // 소지 MCP
                
                // MCP 관절 간 거리 계산
                const dist1 = Math.sqrt(
                    Math.pow(indexBase.x - middleBase.x, 2) + 
                    Math.pow(indexBase.y - middleBase.y, 2)
                );
                
                const dist2 = Math.sqrt(
                    Math.pow(indexBase.x - ringBase.x, 2) + 
                    Math.pow(indexBase.y - ringBase.y, 2)
                );
                
                // 거리의 평균
                const mcpDistance = (dist1 + dist2) / 2;
                
                // Z축 깊이 계산
                const zDepthFactor = 20.0;
                let rawZDepth = -1 * (1.0 - mcpDistance * zDepthFactor);
                rawZDepth = Math.max(-2.0, Math.min(2.0, rawZDepth));
                
                // 7. 손떨림 보정 적용
                let smoothedMcpDistance = mcpDistance;
                if (app.mcpDistanceHistory && app.mcpDistanceHistory[h]) {
                    app.filteredMcpDistance[h] = app.smoothValue(
                        mcpDistance, 
                        app.mcpDistanceHistory[h], 
                        app.filteredMcpDistance[h], 
                        0.2
                    );
                    smoothedMcpDistance = app.filteredMcpDistance[h];
                }
                
                let zDepth = rawZDepth;
                if (app.zDepthHistory && app.zDepthHistory[h]) {
                    app.filteredZDepth[h] = app.smoothValue(
                        rawZDepth, 
                        app.zDepthHistory[h], 
                        app.filteredZDepth[h], 
                        0.15
                    );
                    zDepth = app.filteredZDepth[h];
                }
                
                // UI 업데이트
                app.updateDepthUI(smoothedMcpDistance, zDepth);
                
                // 8. 모든 관절에 Z축 적용
                for (let i = 0; i < landmarks.length && i < app.fingerJoints[h].length; i++) {
                    app.fingerJoints[h][i].position.z = zDepth;
                    
                    // 손가락 관절에 추가 깊이 적용
                    if (i > 0) {
                        const fingerDepth = landmarks[i].z * 0.3;
                        app.fingerJoints[h][i].position.z += fingerDepth;
                    }
                }
                
                // 9. 연결선 및 손 메쉬 업데이트
                app.updateConnections(h);
                app.updateHandMesh(h, landmarks);
                
                // 10. 제스처 인식 (핀치, 손 오므림)
                // 엄지와 검지 끝 거리로 핀치 감지
                const thumbTip = app.fingerJoints[h][4].position;
                const indexTip = app.fingerJoints[h][8].position;
                const pinchDistance = thumbTip.distanceTo(indexTip);
                const isPinchingNow = pinchDistance < 0.1;
                
                // 손 중심점 및 구부러진 손가락 감지
                const fingerTips = [4, 8, 12, 16, 20]; // 손가락 끝
                const fingerBases = [2, 5, 9, 13, 17]; // 손가락 밑부분
                const palmPosition = app.fingerJoints[h][0].position;
                
                // 손 중심점 계산
                let handCenter = new THREE.Vector3();
                
                // 구부러진 손가락 카운팅
                let bentFingers = 0;
                for (let i = 0; i < fingerTips.length; i++) {
                    const tipPos = app.fingerJoints[h][fingerTips[i]].position;
                    const basePos = app.fingerJoints[h][fingerBases[i]].position;
                    const palmDist = tipPos.distanceTo(palmPosition);
                    const extendedDist = basePos.distanceTo(palmPosition) * 2.0;
                    
                    // 손가락이 구부러졌는지 확인
                    if (palmDist < extendedDist * 0.6) {
                        bentFingers++;
                    }
                    
                    // 손 중심점 계산
                    handCenter.add(tipPos);
                }
                handCenter.add(palmPosition);
                handCenter.divideScalar(fingerTips.length + 1);
                
                // 손 중심점 저장
                handCenters.push(handCenter.clone());
                
                // 손 속도 업데이트
                app.updateHandVelocity(h, handCenter);
                
                // 손 오므림 감지
                const isHandClosedNow = bentFingers >= 3;
                
                // 11. 물체와의 상호작용 처리
                for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                    const obj = app.objects[objIdx];
                    const objPos = obj.mesh.position;
                    const distanceToObj = handCenter.distanceTo(objPos);
                    
                    // 물체를 잡는 조건 검사
                    if (!obj.isGrabbed || (obj.grabbers[h] || (!obj.grabbers[0] && !obj.grabbers[1]))) {
                        // 회전 중이 아닐 때만 단일 손 상호작용 처리
                        if (!app.isRotating || !obj.isGrabbed) {
                            // 핀치 시작 - 물체 잡기
                            if (!app.isPinching[h] && isPinchingNow) {
                                if (distanceToObj < 0.4 && !app.isHolding[h]) {
                                    app.isHolding[h] = true;
                                    app.holdType[h] = 'pinch';
                                    obj.isGrabbed = true;
                                    obj.grabbers[h] = true;
                                    obj.mesh.material.color.set(0xff3333);
                                }
                            }
                            // 핀치 종료 - 물체 놓기
                            else if (app.isPinching[h] && !isPinchingNow && app.holdType[h] === 'pinch' && obj.grabbers[h]) {
                                app.releaseObject(objIdx, h);
                                
                                app.isHolding[h] = false;
                                app.holdType[h] = null;
                                obj.grabbers[h] = false;
                                
                                if (!obj.grabbers.includes(true)) {
                                    obj.isGrabbed = false;
                                    obj.mesh.material.color.set(obj.originalColor);
                                }
                            }
                            
                            // 손 오므림 시작 - 물체 잡기
                            if (!app.isHandClosed[h] && isHandClosedNow) {
                                if (distanceToObj < 0.4 && !app.isHolding[h]) {
                                    app.isHolding[h] = true;
                                    app.holdType[h] = 'grab';
                                    obj.isGrabbed = true;
                                    obj.grabbers[h] = true;
                                    obj.mesh.material.color.set(0x3333ff);
                                }
                            }
                            // 손 오므림 종료 - 물체 놓기
                            else if (app.isHandClosed[h] && !isHandClosedNow && app.holdType[h] === 'grab' && obj.grabbers[h]) {
                                app.releaseObject(objIdx, h);
                                
                                app.isHolding[h] = false;
                                app.holdType[h] = null;
                                obj.grabbers[h] = false;
                                
                                if (!obj.grabbers.includes(true)) {
                                    obj.isGrabbed = false;
                                    obj.mesh.material.color.set(obj.originalColor);
                                }
                            }
                        }
                    }
                }
                
                // 12. 검사 모드 제스처 감지
                try {
                    if (landmarks) {
                        const isInspectGesture = app.detectInspectGesture(landmarks, h);
                        
                        if (isInspectGesture && app.isHolding[h]) {
                            for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                                if (app.objects[objIdx].grabbers[h]) {
                                    if (!app.lastInspectGesture) {
                                        app.toggleInspectMode(objIdx);
                                    }
                                    break;
                                }
                            }
                            app.lastInspectGesture = true;
                        } else {
                            app.lastInspectGesture = false;
                        }
                    }
                } catch (error) {
                    console.error("검사 제스처 감지 오류:", error);
                }

                // 13. 회전 모드 제스처 감지
                try {
                    if (!app.useNaturalRotation) {
                        const thumbUp = app.fingerJoints[h][4].position.y < app.fingerJoints[h][2].position.y;
                        const indexStraight = app.fingerJoints[h][8].position.y > app.fingerJoints[h][5].position.y;
                        const othersClosed = bentFingers >= 3;
                
                        const isRotationGesture = thumbUp && indexStraight && othersClosed;
                
                        if (isRotationGesture && app.isHolding[h]) {
                            for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                                if (app.objects[objIdx].grabbers[h]) {
                                    if (!app.isRotationMode[h]) {
                                        app.isRotationMode[h] = true;
                                        console.log(`손 ${h} 회전 모드 시작`);
                                    }
                                    
                                    if (landmarks) {
                                        app.handleSingleHandRotation(h, objIdx);
                                    }
                                    break;
                                }
                            }
                        } else if (app.isRotationMode[h]) {
                            app.isRotationMode[h] = false;
                            app.lastHandDirection[h] = null;
                            console.log(`손 ${h} 회전 모드 종료`);
                        }
                    }
                } catch (error) {
                    console.error("회전 제스처 감지 오류:", error);
                }
                
                // 14. 손목 회전 제스처 처리
                try {
                    if (!app.useNaturalRotation) {
                        for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                            if (app.objects[objIdx].grabbers[h] && landmarks) {
                                app.updateObjectWithWristRotation(h, objIdx, landmarks);
                                break;
                            }
                        }
                    } else if (app.initialHandMatrices && app.initialHandMatrices[h] !== null) {
                        app.resetWristRotation(h);
                    }
                } catch (error) {
                    console.error("손목 회전 처리 오류:", error);
                }

                // 15. 현재 상태 업데이트
                app.isPinching[h] = isPinchingNow;
                app.isHandClosed[h] = isHandClosedNow;

                // 16. 추가 손목 회전 처리
                try {
                    if (app.isHolding[h] && app.holdType[h] === 'pinch' && app.wristRotationEnabled) {
                        for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                            if (app.objects[objIdx].grabbers[h] && landmarks) {
                                app.updateObjectWithWristRotation(h, objIdx, landmarks);
                                break;
                            }
                        }
                    } else if (app.initialHandMatrices && app.initialHandMatrices[h] !== null) {
                        app.resetWristRotation(h);
                    }
                } catch (error) {
                    console.error("확장 손목 회전 처리 오류:", error);
                }

                // 17. 손바닥 감지 및 물체 올리기 처리
                try {
                    if (landmarks) {
                        const isPalmUp = app.isPalmUp(h, landmarks);
                        const palmPlane = app.calculatePalmPlane(h, landmarks);
                        
                        if (app.showPalmVisualizer) {
                            app.visualizePalmPlane(h, landmarks);
                        }
                        
                        if (isPalmUp && !app.isHolding[h]) {
                            if (!app.isPalmMode[h]) {
                                app.isPalmMode[h] = true;
                                console.log(`손 ${h} 손바닥 모드 활성화`);
                            }
                            
                            if (!app.objectsOnPalm[h]) {
                                for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                                    const obj = app.objects[objIdx];
                                    
                                    if (obj.isGrabbed || app.objectsOnPalm.includes(obj)) {
                                        continue;
                                    }
                                    
                                    const objPos = obj.mesh.position;
                                    const distanceToPalm = objPos.distanceTo(palmPlane.center);
                                    
                                    if (distanceToPalm < 0.5 && app.isObjectOverPalm(objPos, h, landmarks)) {
                                        app.objectsOnPalm[h] = obj;
                                        obj.mesh.material.color.set(h === 0 ? 0x99ffcc : 0x99ccff);
                                        console.log(`물체가 손 ${h} 손바닥 위에 올려짐`);
                                        break;
                                    }
                                }
                            } else {
                                const obj = app.objectsOnPalm[h];
                                
                                const targetPosition = new THREE.Vector3()
                                    .copy(palmPlane.center)
                                    .add(new THREE.Vector3().copy(palmPlane.normal).multiplyScalar(obj.mesh.geometry.parameters.height / 2 + 0.05));
                                
                                app.moveObjectTo(app.objects.indexOf(obj), targetPosition);
                                
                                const upVector = new THREE.Vector3().copy(palmPlane.up);
                                const rightVector = new THREE.Vector3().crossVectors(palmPlane.normal, upVector).normalize();
                                
                                const rotationMatrix = new THREE.Matrix4().makeBasis(
                                    rightVector,
                                    upVector,
                                    palmPlane.normal
                                );
                                
                                const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
                                obj.mesh.quaternion.slerp(quaternion, 0.1);
                                obj.body.quaternion.copy(new CANNON.Quaternion(
                                    obj.mesh.quaternion.x, 
                                    obj.mesh.quaternion.y, 
                                    obj.mesh.quaternion.z, 
                                    obj.mesh.quaternion.w
                                ));
                            }
                        } else {
                            if (app.isPalmMode[h]) {
                                if (app.objectsOnPalm[h]) {
                                    const obj = app.objectsOnPalm[h];
                                    
                                    if (!obj.isGrabbed) {
                                        obj.mesh.material.color.set(obj.originalColor);
                                    }
                                    
                                    app.objectsOnPalm[h] = null;
                                    console.log(`물체가 손 ${h} 손바닥에서 벗어남`);
                                }
                                
                                app.isPalmMode[h] = false;
                                console.log(`손 ${h} 손바닥 모드 비활성화`);
                            }
                        }
                    }
                } catch (error) {
                    console.error("손바닥 처리 오류:", error);
                }
                
            } catch (handError) {
                console.error(`손 ${handIdx} 처리 중 오류:`, handError);
            }
        }
        
        // 감지되지 않은 손의 향상된 랜드마크 잔상 제거
        for (let h = 0; h < 2; h++) {
            if (!detectedHands[h]) {
                app.clearSingleHandRemnants(h);
            }
        }
        
        // 18. 두 손 상호작용 처리
        try {
            if (results.multiHandLandmarks.length >= 2) {
                let leftHandIdx = -1;
                let rightHandIdx = -1;
                
                for (let i = 0; i < results.multiHandedness.length; i++) {
                    if (results.multiHandedness[i].label === "Left") {
                        leftHandIdx = i;
                    } else if (results.multiHandedness[i].label === "Right") {
                        rightHandIdx = i;
                    }
                }
                
                if (leftHandIdx !== -1 && rightHandIdx !== -1) {
                    const leftHandArrayIdx = handIndices.indexOf(0);
                    const rightHandArrayIdx = handIndices.indexOf(1);
                    
                    if (leftHandArrayIdx !== -1 && rightHandArrayIdx !== -1) {
                        const leftHandCenter = handCenters[leftHandArrayIdx];
                        const rightHandCenter = handCenters[rightHandArrayIdx];
                        
                        // 왼손과 오른손의 손바닥 방향 계산
                        const leftPalmUp = app.fingerJoints[0][0].position.y < app.fingerJoints[0][9].position.y;
                        const rightPalmUp = app.fingerJoints[1][0].position.y < app.fingerJoints[1][9].position.y;
                        
                        // 두 손 사이의 거리
                        const handDistance = leftHandCenter.distanceTo(rightHandCenter);
                        
                        // 물체 전달 처리
                        if (handDistance < 0.4) {
                            // 오른손 -> 왼손 전달
                            if (app.isHolding[1] && leftPalmUp && !app.isHolding[0]) {
                                let transferredObject = null;
                                
                                for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                                    if (app.objects[objIdx].grabbers[1]) {
                                        transferredObject = app.objects[objIdx];
                                        break;
                                    }
                                }
                                
                                if (transferredObject) {
                                    transferredObject.grabbers[1] = false;
                                    transferredObject.grabbers[0] = true;
                                    
                                    app.holdType[0] = app.holdType[1];
                                    app.holdType[1] = null;
                                    app.isHolding[0] = true;
                                    app.isHolding[1] = false;
                                    
                                    transferredObject.mesh.material.color.set(0xff9900);
                                    transferredObject.isBeingTransferred = true;
                                    transferredObject.transferTime = Date.now();
                                    transferredObject.twoHandGrab = false;
                                    
                                    console.log("물체가 오른손에서 왼손으로 전달됨");
                                }
                            }
                            // 왼손 -> 오른손 전달
                            else if (app.isHolding[0] && rightPalmUp && !app.isHolding[1]) {
                                let transferredObject = null;
                                
                                for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                                    if (app.objects[objIdx].grabbers[0]) {
                                        transferredObject = app.objects[objIdx];
                                        break;
                                    }
                                }
                                
                                if (transferredObject) {
                                    transferredObject.grabbers[0] = false;
                                    transferredObject.grabbers[1] = true;
                                    
                                    app.holdType[1] = app.holdType[0];
                                    app.holdType[0] = null;
                                    app.isHolding[1] = true;
                                    app.isHolding[0] = false;
                                    
                                    transferredObject.mesh.material.color.set(0xff9900);
                                    transferredObject.isBeingTransferred = true;
                                    transferredObject.transferTime = Date.now();
                                    transferredObject.twoHandGrab = false;
                                    
                                    console.log("물체가 왼손에서 오른손으로 전달됨");
                                }
                            }
                        }
                    }
                }
            }
        } catch (twoHandError) {
            console.error("두 손 상호작용 처리 오류:", twoHandError);
        }
        
        // 19. 물체 이동 및 회전 처리
        try {
            for (let objIdx = 0; objIdx < app.objects.length; objIdx++) {
                const obj = app.objects[objIdx];
                let grabbingHands = [];
                
                // 이 물체를 잡고 있는 손 찾기
                for (let h = 0; h < 2; h++) {
                    if (handIndices.includes(h) && app.isHolding[h] && obj.grabbers[h]) {
                        grabbingHands.push({
                            handIndex: h,
                            handArrayIdx: handIndices.indexOf(h)
                        });
                    }
                }
                
                // 한 손으로 물체 잡기
                if (grabbingHands.length === 1) {
                    const handInfo = grabbingHands[0];
                    const h = handInfo.handIndex;
                    const handIdx = handInfo.handArrayIdx;
                    
                    let targetPosition;
                    
                    if (app.holdType[h] === 'pinch') {
                        // 엄지와 검지 사이 중간점으로 이동
                        const thumbTip = app.fingerJoints[h][4].position;
                        const indexTip = app.fingerJoints[h][8].position;
                        targetPosition = new THREE.Vector3()
                            .addVectors(thumbTip, indexTip)
                            .multiplyScalar(0.5);
                    } else if (app.holdType[h] === 'grab') {
                        // 손 중심으로 이동
                        targetPosition = handCenters[handIdx];
                    }
                    
                    // 물체 이동
                    app.moveObjectTo(objIdx, targetPosition);
                    
                    // 손의 회전에 따라 물체 회전 업데이트
                    if (h >= 0 && h < storedLandmarks.length && handIndices.indexOf(h) !== -1) {
                        const landmarkIdx = handIndices.indexOf(h);
                        if (landmarkIdx >= 0 && landmarkIdx < storedLandmarks.length) {
                            try {
                                app.updateObjectRotationWithHand(h, objIdx, storedLandmarks[landmarkIdx]);
                            } catch (err) {
                                console.error("물체 회전 업데이트 오류:", err);
                            }
                        }
                    }
                    
                    // 물체 상태 처리
                    if (!obj.twoHandGrab) {
                        obj.mesh.material.color.set(0xffff00); // 노란색
                        obj.twoHandGrab = true;
                        obj.isBeingTransferred = false;
                        console.log("양손으로 물체를 잡음 - 회전 모드");
                        obj.initialTwoHandGrab = true;
                    } else {
                        obj.mesh.material.color.set(0xffff00); 
                    }
                    
                    app.isRotating = false;
                }
                // 양손으로 물체 잡기
                else if (grabbingHands.length === 2) {
                    const hand0 = grabbingHands[0];
                    const hand1 = grabbingHands[1];
                    const hand0Idx = hand0.handArrayIdx;
                    const hand1Idx = hand1.handArrayIdx;
                    
                    // 두 손의 중간 지점으로 물체 이동
                    const targetPosition = new THREE.Vector3()
                        .addVectors(handCenters[hand0Idx], handCenters[hand1Idx])
                        .multiplyScalar(0.5);
                    
                    app.moveObjectTo(objIdx, targetPosition);
                    
                    // 두 손 방향에 따른 회전
                    const handDirection = app.calculateHandDirection(
                        handCenters[hand0Idx], 
                        handCenters[hand1Idx]
                    );
                    
                    // 회전 시작
                    if (!app.isRotating) {
                        app.isRotating = true;
                        app.initialHandDirection.copy(handDirection);
                        app.initialCubeRotation.copy(obj.mesh.rotation);
                    }
                    // 회전 계속
                    else {
                        const angle = app.initialHandDirection.angleTo(handDirection);
                        const axis = new THREE.Vector3()
                            .crossVectors(app.initialHandDirection, handDirection)
                            .normalize();
                        
                        if (angle > 0.01 && axis.length() > 0.01) {
                            const deltaRotation = new THREE.Quaternion()
                                .setFromAxisAngle(axis, angle);
                            
                            const initialQuat = new THREE.Quaternion()
                                .setFromEuler(app.initialCubeRotation);
                            const newQuat = initialQuat.multiply(deltaRotation);
                            
                            obj.mesh.quaternion.copy(newQuat);
                            obj.body.quaternion.copy(
                                new CANNON.Quaternion(
                                    newQuat.x, newQuat.y, newQuat.z, newQuat.w
                                )
                            );
                        }
                    }
                }
            }
        } catch (objectError) {
            console.error("물체 이동/회전 처리 오류:", objectError);
        }
        
        // 20. 회전 상태 업데이트
        try {
            let anyObjectRotating = false;
            for (let obj of app.objects) {
                if (obj.grabbers.filter(Boolean).length === 2) {
                    anyObjectRotating = true;
                    break;
                }
            }
            if (!anyObjectRotating) {
                app.isRotating = false;
            }
        } catch (rotationStateError) {
            console.error("회전 상태 업데이트 오류:", rotationStateError);
        }
        
    } catch (globalError) {
        console.error("손 추적 처리 중 전역 오류:", globalError);
        // 모든 상태 초기화
        app.recoverFromError();
    }
};
// 양손 회전 개선을 위한 코드
app.handleTwoHandRotation = function(obj, hand1Center, hand2Center) {
    // 현재 두 손 사이의 방향 벡터
    const currentDirection = new THREE.Vector3().subVectors(hand2Center, hand1Center).normalize();
    
    // 회전 시작 시 초기 상태 저장
    if (!app.isRotating) {
        app.isRotating = true;
        app.initialHandDirection = currentDirection.clone();
        app.initialCubeRotation = obj.mesh.rotation.clone();
        app.startQuaternion = obj.mesh.quaternion.clone();
        return;
    }
    
    // 두 방향 사이의 회전 계산
    const rotationAxis = new THREE.Vector3().crossVectors(app.initialHandDirection, currentDirection).normalize();
    const angle = app.initialHandDirection.angleTo(currentDirection);
    
    // 작은 회전만 처리 (노이즈 방지)
    if (angle > 0.01 && angle < 0.3 && rotationAxis.length() > 0.1) {
        const rotationQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
        
        // 새 회전 계산 - 방법 개선
        const newQuat = new THREE.Quaternion().copy(app.startQuaternion).premultiply(rotationQuat);
        
        // 회전 적용
        obj.mesh.quaternion.copy(newQuat);
        obj.body.quaternion.copy(new CANNON.Quaternion(
            newQuat.x, newQuat.y, newQuat.z, newQuat.w
        ));
    }
};
app.handleSingleHandRotation = function(handIndex, objectIndex) {
    const obj = app.objects[objectIndex];
    
    // 손목과 검지 끝 위치
    const wrist = app.fingerJoints[handIndex][0].position;
    const indexTip = app.fingerJoints[handIndex][8].position;
    
    // 방향 벡터 계산 및 정규화
    const direction = new THREE.Vector3().subVectors(indexTip, wrist).normalize();
    
    // 회전 시작 - 초기 상태 저장
    if (!app.lastHandDirection[handIndex]) {
        app.lastHandDirection[handIndex] = direction.clone();
        app.rotationStartQuaternion[handIndex] = obj.mesh.quaternion.clone();
        return;
    }
    
    // 이전 방향에서 현재 방향으로의 회전 계산
    const rotationAxis = new THREE.Vector3().crossVectors(
        app.lastHandDirection[handIndex], 
        direction
    ).normalize();
    
    const angle = app.lastHandDirection[handIndex].angleTo(direction);
    
    // 안정적인 회전을 위한 범위 제한
    if (angle > 0.01 && angle < 0.15 && rotationAxis.length() > 0.1) {
        // 손 움직임에 따른 회전 방향 보정
        let adjustedAxis = rotationAxis.clone();
        
        // y축 회전 증폭 (사용자 경험 향상)
        if (Math.abs(adjustedAxis.y) > 0.5) {
            adjustedAxis.y *= 1.5;
            adjustedAxis.normalize();
        }
        
        // 회전 쿼터니언 계산
        const rotationQuat = new THREE.Quaternion().setFromAxisAngle(
            adjustedAxis, 
            angle * 2.5 // 회전 감도 증가
        );
        
        // 현재 물체 회전에 적용
        obj.mesh.quaternion.multiplyQuaternions(rotationQuat, obj.mesh.quaternion);
        
        // 물리 엔진 업데이트
        obj.body.quaternion.copy(obj.mesh.quaternion);
    }
    
    // 현재 방향 저장 (다음 프레임에서 사용)
    app.lastHandDirection[handIndex].copy(direction);
};