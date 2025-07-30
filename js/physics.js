// physics.js - CANNON.js 물리 엔진 설정 및 관리

// 물리 엔진 초기화
app.initPhysics = function() {
    // 물리 세계 생성
    app.world = new CANNON.World();
    app.world.gravity.set(0, -15, 0); // 중력을 약간 더 강하게 (더 현실적인 낙하)
    app.world.broadphase = new CANNON.NaiveBroadphase();
    app.world.solver.iterations = 15; // 물리 계산 정확도 향상
    
    // 바닥 생성 (무한 질량을 가진 평면)
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 }); // 무한 질량 = 고정
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // x축을 기준으로 -90도 회전
    groundBody.position.set(0, -1.5, 0); // 시각적 바닥과 동일한 위치로 설정
    app.world.addBody(groundBody);

    // 기본 접촉 동작 설정 (더 안정적으로)
    const defaultMaterial = new CANNON.Material("default");
    const defaultContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial, 
        defaultMaterial, 
        {
            friction: 0.9,      // 마찰력 증가 (더 미끄럽지 않게)
            restitution: 0.1,   // 반발력 약간 증가 (자연스러운 튕김)
            contactEquationStiffness: 1e7,    // 접촉 강성 증가 (더 단단하게)
            contactEquationRelaxation: 3      // 접촉 완화 유지
        }
    );

    // 세계에 접촉 재질 추가
    app.world.addContactMaterial(defaultContactMaterial);
    app.world.defaultContactMaterial = defaultContactMaterial;

    // 충돌 감지 개선을 위한 코드 추가
    app.setupCollisionEvents = function() {
        // 모든 물체에 충돌 이벤트 등록
        app.objects.forEach(function(object, index) {
            object.body.addEventListener("collide", function(e) {
                // 충돌 후 물리 상태 안정화
                if (!object.isGrabbed) {
                    // 충돌 후 약간의 댐핑 추가
                    object.body.linearDamping = 0.7; // 충돌 후 일시적으로 댐핑 증가
                    object.body.angularDamping = 0.7;
                    
                    // 일정 시간 후 기본값으로 복원
                    setTimeout(function() {
                        object.body.linearDamping = 0.5;
                        object.body.angularDamping = 0.5;
                    }, 500);
                }
            });
        });
    };
};