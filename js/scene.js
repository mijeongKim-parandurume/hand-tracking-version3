// scene.js - Three.js 씬 설정 및 3D 객체 관리

// 손 메쉬 변수 추가
app.handMeshes3D = [null, null]; // [왼손, 오른손] 메쉬
app.handSkeletons = [null, null]; // 본 정보 저장
app.handBonesMap = [null, null]; // 본 이름과 Object3D 매핑
app.useMeshModels = false; // 메쉬 모델 사용 여부 (토글용)
app.useSimpleLandmarks = false; // 단순 랜드마크 시각화 모드

// MediaPipe 랜드마크 인덱스와 본 이름 매핑
app.landmarkToGLTFBone = [
    "wrist",           // 0 - 손목
    "thumb_cmc",       // 1 - 엄지 CMC
    "thumb_mcp",       // 2 - 엄지 MCP
    "thumb_ip",        // 3 - 엄지 IP
    "thumb_tip",       // 4 - 엄지 끝
    "index_finger_mcp", // 5 - 검지 MCP
    "index_finger_pip", // 6 - 검지 PIP
    "index_finger_dip", // 7 - 검지 DIP
    "index_finger_tip", // 8 - 검지 끝
    "middle_finger_mcp", // 9 - 중지 MCP
    "middle_finger_pip", // 10 - 중지 PIP
    "middle_finger_dip", // 11 - 중지 DIP
    "middle_finger_tip", // 12 - 중지 끝
    "ring_finger_mcp",  // 13 - 약지 MCP
    "ring_finger_pip",  // 14 - 약지 PIP
    "ring_finger_dip",  // 15 - 약지 DIP
    "ring_finger_tip",  // 16 - 약지 끝
    "pinky_mcp",       // 17 - 소지 MCP
    "pinky_pip",       // 18 - 소지 PIP
    "pinky_dip",       // 19 - 소지 DIP
    "pinky_tip"        // 20 - 소지 끝
];

// Three.js 초기화
app.initThree = function() {
    // 씬 생성
    app.scene = new THREE.Scene();
    app.scene.background = new THREE.Color(0x202020);

// 카메라 설정
    // 카메라 전환 함수 코드
    app.isPerspective = true; // 기본값은 퍼스펙티브 카메라
    // PerspectiveCamera 사용:
    app.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    app.camera.position.set(0, 1.5, 3); // 약간 더 높고 멀리 위치시킵니다
    app.camera.lookAt(0, 0, 0);
    // OrthographicCamera 사용:
    app.setupOrthographicCamera = function() {
        const aspectRatio = window.innerWidth / window.innerHeight;
        const viewSize = 3;
        app.camera = new THREE.OrthographicCamera(
            -viewSize * aspectRatio, viewSize * aspectRatio,
            viewSize, -viewSize,
            0.1, 1000
        );
        app.camera.position.set(0, 1.0, 4);
        app.camera.lookAt(0, 0, 0);
        app.camera.updateProjectionMatrix();
    };
    // 카메라 전환 함수 정의
    app.setupPerspectiveCamera = function() {
        app.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        app.camera.position.set(0, 1.0, 3.0);
        app.camera.lookAt(0, 0, 0);
        app.camera.updateProjectionMatrix();
        console.log("Perspective camera set up");
    };
    app.setupOrthographicCamera = function() {
        const aspectRatio = window.innerWidth / window.innerHeight;
        const viewSize = 3;
        app.camera = new THREE.OrthographicCamera(
            -viewSize * aspectRatio, viewSize * aspectRatio,
            viewSize, -viewSize,
            0.1, 1000
        );
        app.camera.position.set(0, 1.0, 4);
        app.camera.lookAt(0, 0, 0);
        app.camera.updateProjectionMatrix();
        console.log("Orthographic camera set up");
    };
    // 토글 버튼 이벤트 리스너 (app.initThree 함수 끝부분에 추가)
    const cameraButton = document.getElementById('toggleCameraButton');
    if (cameraButton) {
        cameraButton.addEventListener('click', function() {
            console.log("Toggle button clicked");
            app.isPerspective = !app.isPerspective;
            
            if (app.isPerspective) {
                if (typeof app.setupPerspectiveCamera === 'function') {
                    app.setupPerspectiveCamera();
                    this.textContent = '직교 카메라로 전환';
                } else {
                    console.error("setupPerspectiveCamera is not defined");
                }
            } else {
                if (typeof app.setupOrthographicCamera === 'function') {
                    app.setupOrthographicCamera();
                    this.textContent = '원근 카메라로 전환';
                } else {
                    console.error("setupOrthographicCamera is not defined");
                }
            }
        });
    }

    // 렌더러 설정
    app.renderer = new THREE.WebGLRenderer({ antialias: true });
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    app.renderer.setPixelRatio(window.devicePixelRatio || 1);
    document.body.appendChild(app.renderer.domElement);

    // 조명 설정 개선 (손 모델을 위한 더 자연스러운 조명)
    // 1. 앰비언트 라이트 (전체적인 밝기)
    const ambientLight = new THREE.AmbientLight(0x666666, 0.6); // 더 밝게
    app.scene.add(ambientLight);

    // 2. 메인 방향 조명 (키 라이트)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    
    // 그림자 설정 개선
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.mapSize.width = 4096; // 고품질 그림자
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.radius = 8; // 부드러운 그림자
    mainLight.shadow.bias = -0.0001;
    
    app.scene.add(mainLight);

    // 3. 필 라이트 (반대편에서 부드럽게 채우는 조명)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 2, -1);
    app.scene.add(fillLight);

    // 4. 림 라이트 (윤곽선 강조)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 1, -3);
    app.scene.add(rimLight);

    // 그림자 설정 활성화
    app.renderer.shadowMap.enabled = true;
    app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 재질 수정
    app.jointMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    // 랜드마크 = 구
    app.jointGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    app.connectionMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });

    // 바닥 설정 (자연스러운 색상으로 복원)
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x808080, // 원래의 중간 회색으로 복원
        shininess: 5,
        specular: 0x111111
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5; // 바닥을 조금 더 아래로
    floor.receiveShadow = true; // 그림자 받기 활성화
    app.scene.add(floor);

    // 상호작용할 큐브 3개 생성 (바닥 위에 배치)
    const cubeSize = 0.2; // 큐브 크기
    const floorY = -1.5; // 바닥 Y 위치
    const cubeY = floorY + cubeSize / 2; // 큐브가 바닥에 닿도록 Y 위치 계산
    
    app.createInteractiveObject(new THREE.Vector3(-0.5, cubeY, 0), 0x00ff00); // 녹색 큐브
    app.createInteractiveObject(new THREE.Vector3(0, cubeY, 0), 0x3399ff);    // 파란색 큐브  
    app.createInteractiveObject(new THREE.Vector3(0.5, cubeY, 0), 0xff6600);  // 주황색 큐브
    // app.createInteractiveSphere(new THREE.Vector3(-0.5, 0, 0), 0x00ff00); // 녹색 구
    // app.createInteractiveObject(new THREE.Vector3(0, 0, 0), 0x3399ff);    // 파란색 큐브  
    // app.createInteractiveCylinder(new THREE.Vector3(0.5, 0, 0), 0x8844ff);     // 보라색 실린더 


    // 양손에 대한 관절 메시 생성
    for (let h = 0; h < 2; h++) {
        // 각 손마다 21개 관절 생성
        for (let i = 0; i < 21; i++) {
            const joint = new THREE.Mesh(app.jointGeometry, app.jointMaterial.clone());
            joint.castShadow = true;
            joint.visible = false;
            app.fingerJoints[h].push(joint);
            app.scene.add(joint);
        }

        // 각 손에 대한 메시 생성
        app.handMeshes[h] = new THREE.Object3D();
        app.handMeshes[h].name = `hand_${h}`;
        app.scene.add(app.handMeshes[h]);

        // 손가락 연결선 생성 (뼈대)
        app.createHandConnections(h);
        
        // 손 위치 이력 초기화
        for (let i = 0; i < app.velocityHistoryLength; i++) {
            app.handPositions[h].push(new THREE.Vector3());
        }
    }
    
    // 3D 손 메쉬 로드
    app.loadHandMeshes();
    
    // 메쉬 토글 버튼 이벤트 리스너 추가 - 3단계 모드
    const toggleButton = document.getElementById('toggleMeshButton');
    if (toggleButton) {
        let visualMode = 0; // 0: 기본 랜드마크, 1: 3D 모델, 2: 향상된 랜드마크
        const modeNames = ['기본 랜드마크', '3D 손 모델', '향상된 랜드마크'];
        
        toggleButton.addEventListener('click', function() {
            visualMode = (visualMode + 1) % 3;
            
            if (visualMode === 0) {
                // 기본 랜드마크 모드
                app.useMeshModels = false;
                app.useSimpleLandmarks = false;
                this.textContent = '3D 손 모델 표시';
            } else if (visualMode === 1) {
                // 3D 손 모델 모드
                app.useMeshModels = true;
                app.useSimpleLandmarks = false;
                this.textContent = '향상된 랜드마크 표시';
            } else {
                // 향상된 랜드마크 모드
                app.useMeshModels = false;
                app.useSimpleLandmarks = true;
                this.textContent = '기본 랜드마크 표시';
            }
            
            console.log(`시각화 모드 변경: ${modeNames[visualMode]}`);
        });
    }
    
    // 애니메이션 루프 시작
    animate();

    // scene.js 파일의 app.initThree 함수 끝부분에 추가할 코드
    // 메쉬 크기 및 위치 제어 슬라이더 설정
    app.meshScale = 0.1;
    app.meshOffsetX = 0;
    app.meshOffsetY = 0;
    app.meshOffsetZ = 0;

    // 슬라이더 요소 가져오기
    const scaleSlider = document.getElementById('meshScaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    const offsetXSlider = document.getElementById('meshOffsetXSlider');
    const offsetXValue = document.getElementById('offsetXValue');
    const offsetYSlider = document.getElementById('meshOffsetYSlider');
    const offsetYValue = document.getElementById('offsetYValue');
    const offsetZSlider = document.getElementById('meshOffsetZSlider');
    const offsetZValue = document.getElementById('offsetZValue');

    // 크기 슬라이더 이벤트
    if (scaleSlider) {
        scaleSlider.addEventListener('input', function() {
            app.meshScale = parseFloat(this.value);
            scaleValue.textContent = app.meshScale.toFixed(2);
            
            // 이미 로드된 메쉬에 적용
            if (app.handMeshes3D[0]) app.handMeshes3D[0].scale.set(app.meshScale, app.meshScale, app.meshScale);
            if (app.handMeshes3D[1]) app.handMeshes3D[1].scale.set(app.meshScale, app.meshScale, app.meshScale);
        });
    }

    // X 오프셋 슬라이더 이벤트
    if (offsetXSlider) {
        offsetXSlider.addEventListener('input', function() {
            app.meshOffsetX = parseFloat(this.value);
            offsetXValue.textContent = app.meshOffsetX.toFixed(2);
        });
    }

    // Y 오프셋 슬라이더 이벤트
    if (offsetYSlider) {
        offsetYSlider.addEventListener('input', function() {
            app.meshOffsetY = parseFloat(this.value);
            offsetYValue.textContent = app.meshOffsetY.toFixed(2);
        });
    }

    // Z 오프셋 슬라이더 이벤트
    if (offsetZSlider) {
        offsetZSlider.addEventListener('input', function() {
            app.meshOffsetZ = parseFloat(this.value);
            offsetZValue.textContent = app.meshOffsetZ.toFixed(2);
        });
    }
    // scene.js 파일의 app.initThree 함수 내에 추가
    // 손 좌표계 시각화를 위한 헬퍼 생성
    app.handCoordHelpers = [null, null];
    for (let h = 0; h < 2; h++) {
        const axesHelper = new THREE.AxesHelper(0.2);
        axesHelper.visible = false;
        app.scene.add(axesHelper);
        app.handCoordHelpers[h] = axesHelper;
    }

    // 손목 회전 디버깅 UI 추가
    const debugUI = document.createElement('div');
    debugUI.style.position = 'fixed';
    debugUI.style.bottom = '130px';
    debugUI.style.left = '10px';
    debugUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugUI.style.color = 'white';
    debugUI.style.padding = '10px';
    debugUI.style.borderRadius = '5px';
    debugUI.style.zIndex = '100';
    debugUI.innerHTML = `
        <p>손목 회전 모드: <span id="wristRotationStatus">활성화</span></p>
        <button id="toggleWristRotation">손목 회전 끄기</button>
    `;
    document.body.appendChild(debugUI);

    // 손목 회전 토글 버튼 이벤트 리스너
    const wristToggleBtn = document.getElementById('toggleWristRotation');
    const wristStatusSpan = document.getElementById('wristRotationStatus');
    if (wristToggleBtn && wristStatusSpan) {
        wristToggleBtn.addEventListener('click', function() {
            app.wristRotationEnabled = !app.wristRotationEnabled;
            if (app.wristRotationEnabled) {
                this.textContent = '손목 회전 끄기';
                wristStatusSpan.textContent = '활성화';
            } else {
                this.textContent = '손목 회전 켜기';
                wristStatusSpan.textContent = '비활성화';
            }
        });
    }
};

// 상호작용 가능한 큐브 생성
app.createInteractiveObject = function(position, color) {
    // Three.js 큐브 생성
    const size = 0.2;
    const cubeGeometry = new THREE.BoxGeometry(size, size, size);
    const cubeMaterial = new THREE.MeshPhongMaterial({ color: color || 0x00ff00 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.copy(position);
    cube.castShadow = true;
    app.scene.add(cube);

    // 그림자 설정 추가
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // CANNON.js 물리 바디 생성
    const cubeShape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
    const cubeBody = new CANNON.Body({ 
        mass: 1,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        shape: cubeShape,
        material: new CANNON.Material({
            friction: 0.8,
            restitution: 0.05
        })
    });

    // 물리 특성 설정
    cubeBody.linearDamping = 0.5;  // 선형 감쇠 감소
    cubeBody.angularDamping = 0.5; // 각 감쇠 감소
    
    // 물리 세계에 추가
    app.world.addBody(cubeBody);
    
    // 물체 정보 객체 생성 및 저장
    const object = {
        mesh: cube,
        body: cubeBody,
        isGrabbed: false,
        grabbers: [false, false], // 어떤 손에 잡혔는지 [왼손, 오른손]
        originalColor: color || 0x00ff00, // 원래 색상 저장
        twoHandGrab: false, // 양손으로 잡고 있는지 상태
        isBeingTransferred: false, // 한 손에서 다른 손으로 전달 중인지
        transferTime: 0, // 전달이 시작된 시간
        initialTwoHandGrab: false // 회전 초기화를 위한 플래그
    };
    
    app.objects.push(object);
    
    return object;
};

// 상호작용 가능한 구 생성
// app.createInteractiveSphere = function(position, color) {
//     // Three.js 구 생성
//     const radius = 0.1; // 구의 반지름
//     const segments = 32; // 구의 세분화 정도
//     const sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
//     const sphereMaterial = new THREE.MeshPhongMaterial({ color: color || 0x00ff00 });
//     const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
//     sphere.position.copy(position);
//     sphere.castShadow = true;
//     sphere.receiveShadow = true;
//     app.scene.add(sphere);
    
//     // CANNON.js 물리 바디 생성
//     const sphereShape = new CANNON.Sphere(radius);
//     const sphereBody = new CANNON.Body({ 
//         mass: 1,
//         position: new CANNON.Vec3(position.x, position.y, position.z),
//         shape: sphereShape,
//         material: new CANNON.Material({
//             friction: 0.8,
//             restitution: 0.05
//         })
//     });

//     // 물리 특성 설정
//     sphereBody.linearDamping = 0.5;
//     sphereBody.angularDamping = 0.5;
    
//     // 물리 세계에 추가
//     app.world.addBody(sphereBody);
    
//     // 물체 정보 객체 생성 및 저장
//     const object = {
//         mesh: sphere,
//         body: sphereBody,
//         isGrabbed: false,
//         grabbers: [false, false],
//         originalColor: color || 0x00ff00,
//         twoHandGrab: false,
//         isBeingTransferred: false,
//         transferTime: 0,
//         initialTwoHandGrab: false
//     };
    
//     app.objects.push(object);
    
//     return object;
// };

// 상호작용 가능한 원기둥(실린더) 생성 - Z축 기준 세워짐, 바닥에 닿음
// app.createInteractiveCylinder = function(position, color) {
//     // Three.js 실린더 생성
//     const radius = 0.1; // 실린더의 반지름
//     const height = 0.3; // 실린더의 높이
//     const segments = 32; // 실린더의 분할 수(원의 부드러움 결정)
    
//     // 실린더 지오메트리 생성 (위, 아래 반지름 동일)
//     const cylinderGeometry = new THREE.CylinderGeometry(
//         radius,    // 윗면 반지름
//         radius,    // 아랫면 반지름 
//         height,    // 높이
//         segments,  // 원주 세그먼트 수
//         1,         // 높이 방향 세그먼트 수
//         false      // 열린/닫힌 실린더 (false=닫힘)
//     );
    
//     // 머티리얼 생성
//     const cylinderMaterial = new THREE.MeshPhongMaterial({ 
//         color: color || 0x8844ff, 
//         shininess: 30 
//     });
    
//     // 실린더 메시 생성
//     const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    
//     // 실린더를 Z축 기준으로 세우기 위한 회전 적용
//     // X축 기준으로 90도 회전시키면 Y축에서 Z축으로 변경됨
//     cylinder.rotation.x = Math.PI / 2;
    
//     // 바닥에 닿도록 위치 조정
//     // 바닥 y값은 -1, 원기둥의 반지름만큼 올려서 바닥에 닿게 함
//     const floorY = -1;
//     const adjustedPosition = new THREE.Vector3(
//         position.x,
//         floorY + radius, // 바닥 + 반지름 = 원의 중심 높이
//         position.z
//     );
//     cylinder.position.copy(adjustedPosition);
    
//     // 그림자 설정
//     cylinder.castShadow = true;
//     cylinder.receiveShadow = true;
    
//     // 씬에 추가
//     app.scene.add(cylinder);
    
//     // CANNON.js 물리 바디 생성
//     // 실린더 형태의 물리 바디 생성
//     const cylinderShape = new CANNON.Cylinder(
//         radius,     // 윗면 반지름
//         radius,     // 아랫면 반지름
//         height,     // 높이
//         segments    // 세그먼트 수
//     );
    
//     // 물리 바디 생성
//     const cylinderBody = new CANNON.Body({ 
//         mass: 1,   // 질량
//         position: new CANNON.Vec3(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z),
//         shape: cylinderShape,
//         material: new CANNON.Material({
//             friction: 0.8,
//             restitution: 0.05
//         })
//     });
    
//     // Z축 기준으로 서게 하기 위한 회전
//     // X축 기준으로 90도 회전 (Y축 → Z축)
//     const quat = new CANNON.Quaternion();
//     quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
//     cylinderBody.quaternion.copy(quat);
    
//     // 물리 특성 설정
//     cylinderBody.linearDamping = 0.5;  // 선형 감쇠
//     cylinderBody.angularDamping = 0.5; // 각 감쇠
    
//     // 물리 세계에 추가
//     app.world.addBody(cylinderBody);
    
//     // 물체 정보 객체 생성 및 저장
//     const object = {
//         mesh: cylinder,
//         body: cylinderBody,
//         isGrabbed: false,
//         grabbers: [false, false], // 어떤 손에 잡혔는지 [왼손, 오른손]
//         originalColor: color || 0x8844ff, // 원래 색상 저장
//         twoHandGrab: false, // 양손으로 잡고 있는지 상태
//         isBeingTransferred: false, // 한 손에서 다른 손으로 전달 중인지
//         transferTime: 0, // 전달이 시작된 시간
//         initialTwoHandGrab: false // 회전 초기화를 위한 플래그
//     };
    
//     app.objects.push(object);
    
//     return object;
// };

// 손가락 관절을 연결하는 선 생성
app.createHandConnections = function(handIndex) {
    // 손가락 관절 연결 정의 (MediaPipe 인덱스 기준)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],         // 엄지
        [0, 5], [5, 6], [6, 7], [7, 8],         // 검지
        [0, 9], [9, 10], [10, 11], [11, 12],    // 중지
        [0, 13], [13, 14], [14, 15], [15, 16],  // 약지
        [0, 17], [17, 18], [18, 19], [19, 20],  // 소지
        [5, 9], [9, 13], [13, 17],              // 손바닥
        [0, 5], [0, 17]                         // 손목-손바닥
    ];

    // 각 연결선에 대해 라인 생성
    connections.forEach(conn => {
        const geometry = new THREE.BufferGeometry();
        const line = new THREE.Line(geometry, app.connectionMaterial.clone());
        line.name = `connection_${handIndex}_${conn[0]}_${conn[1]}`;
        line.userData = { startJoint: conn[0], endJoint: conn[1] };
        line.visible = false;
        app.handMeshes[handIndex].add(line);
    });
};

// GLB 모델 로드 함수
app.loadHandMeshes = function() {
    // GLTFLoader 생성 (이미 로더가 존재하는지 확인)
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('THREE.GLTFLoader가 정의되지 않았습니다. 라이브러리가 로드되었는지 확인하세요.');
        return;
    }
    
    const loader = new THREE.GLTFLoader();
    
    // 왼손 모델 로드
    loader.load('models/LeftHand.glb', function(gltf) {
        // 전체 씬 그룹
        const leftHandGroup = gltf.scene;
        
        // 스케일 조정
        // leftHandGroup.scale.set(0.5, 0.5, 0.5); // 크기 조정 (필요에 따라 조정)
        leftHandGroup.scale.set(app.meshScale, app.meshScale, app.meshScale);
        
        // 씬에 추가
        app.scene.add(leftHandGroup);
        
        // 손 메쉬 저장
        app.handMeshes3D[0] = leftHandGroup;
        
        // 처음에는 숨김
        leftHandGroup.visible = false;
        
        // 본 매핑 초기화
        const bonesMap = {};
        leftHandGroup.traverse(function(node) {
            // 메쉬 재질 설정
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // 재질 조정이 필요한 경우
                if (node.material) {
                    node.material.transparent = true;
                    node.material.opacity = 0.9;
                }
            }
            
            // 본 이름 저장
            if (node.isBone || node.isObject3D) {
                bonesMap[node.name] = node;
            }
        });
        
        app.handBonesMap[0] = bonesMap;
        console.log("왼손 모델 로드 완료");
        console.log("왼손 본 이름들:", Object.keys(bonesMap));
        console.log("예상 본 이름들:", app.landmarkToGLTFBone);
        
        // 본 매핑 검증
        app.landmarkToGLTFBone.forEach((expectedBoneName, index) => {
            if (!bonesMap[expectedBoneName]) {
                console.warn(`왼손: 본 '${expectedBoneName}' (인덱스 ${index})를 찾을 수 없습니다`);
            }
        });
    }, undefined, function(error) {
        console.error('왼손 모델 로드 실패:', error);
    });
    
    // 오른손 모델 로드
    loader.load('models/RightHand.glb', function(gltf) {
        // 전체 씬 그룹
        const rightHandGroup = gltf.scene;
        
        // 스케일 조정
        // rightHandGroup.scale.set(0.5, 0.5, 0.5); // 크기 조정 (필요에 따라 조정)
        rightHandGroup.scale.set(app.meshScale, app.meshScale, app.meshScale);
        
        // 씬에 추가
        app.scene.add(rightHandGroup);
        
        // 손 메쉬 저장
        app.handMeshes3D[1] = rightHandGroup;
        
        // 처음에는 숨김
        rightHandGroup.visible = false;
        
        // 본 매핑 초기화
        const bonesMap = {};
        rightHandGroup.traverse(function(node) {
            // 메쉬 재질 설정
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // 재질 조정이 필요한 경우
                if (node.material) {
                    node.material.transparent = true;
                    node.material.opacity = 0.9;
                }
            }
            
            // 본 이름 저장
            if (node.isBone || node.isObject3D) {
                bonesMap[node.name] = node;
            }
        });
        
        app.handBonesMap[1] = bonesMap;
        console.log("오른손 모델 로드 완료");
        console.log("오른손 본 이름들:", Object.keys(bonesMap));
        console.log("예상 본 이름들:", app.landmarkToGLTFBone);
        
        // 본 매핑 검증
        app.landmarkToGLTFBone.forEach((expectedBoneName, index) => {
            if (!bonesMap[expectedBoneName]) {
                console.warn(`오른손: 본 '${expectedBoneName}' (인덱스 ${index})를 찾을 수 없습니다`);
            }
        });
    }, undefined, function(error) {
        console.error('오른손 모델 로드 실패:', error);
    });
};
app.boneParentMap = {
    1: 0, 2: 1, 3: 2, 4: 3,         // thumb
    5: 0, 6: 5, 7: 6, 8: 7,         // index
    9: 0, 10: 9, 11: 10, 12: 11,    // middle
    13: 0, 14: 13, 15: 14, 16: 15,  // ring
    17: 0, 18: 17, 19: 18, 20: 19   // pinky
  };
  