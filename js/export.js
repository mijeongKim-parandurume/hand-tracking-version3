import { GLTFExporter } from 'https://unpkg.com/three@0.152.2/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'https://unpkg.com/three@0.152.2/examples/jsm/exporters/OBJExporter.js';

// 네임스페이스 확인
window.app = window.app || {};

// 디버깅을 위한 자세한 로그 기능 추가
app.debug = true;
app.log = function(message, obj) {
    if (app.debug) {
        if (obj) {
            console.log(message, obj);
        } else {
            console.log(message);
        }
    }
};

// 그리고 이를 사용할 때:
const exporter = new GLTFExporter();

// 리깅 정보를 포함하여 손 메쉬를 GLB로 내보내는 함수
app.exportHandMeshWithRigging = function(handIndex) {
    app.log(`손 메쉬 내보내기 시작 (handIndex: ${handIndex})`);
    
    // 손 메쉬 존재 여부 검사 - 더 자세한 로그
    if (!app.handMeshes3D) {
        console.error("app.handMeshes3D가 정의되지 않았습니다");
        return;
    }
    
    if (!app.handMeshes3D[handIndex]) {
        console.error(`app.handMeshes3D[${handIndex}]가 정의되지 않았습니다`);
        return;
    }
    
    if (!app.handBonesMap) {
        console.error("app.handBonesMap이 정의되지 않았습니다");
        return;
    }
    
    if (!app.handBonesMap[handIndex]) {
        console.error(`app.handBonesMap[${handIndex}]가 정의되지 않았습니다`);
        return;
    }
    
    // GLTFExporter 존재 여부 확인
    if (typeof THREE.GLTFExporter === 'undefined') {
        console.error("THREE.GLTFExporter가 정의되지 않았습니다. GLTFExporter.js가 로드되었는지 확인하세요.");
        alert("THREE.GLTFExporter가 로드되지 않았습니다. GLTFExporter.js 스크립트를 추가하세요.");
        return;
    }
    
    app.log("메쉬와 본 맵 확인 완료, 내보내기 진행");
    
    try {
        // 내보낼 씬 생성
        const exportScene = new THREE.Scene();
        
        // 손 메쉬 복제
        const handMeshClone = app.handMeshes3D[handIndex].clone(true);
        exportScene.add(handMeshClone);
        
        app.log("손 메쉬 복제 완료", handMeshClone);
        
        // 본 정보 확인 및 디버깅
        app.log("본 맵 구조:", app.handBonesMap[handIndex]);
        
        // 스켈레톤 데이터 생성
        const skeleton = createSkeletonFromBones(app.handBonesMap[handIndex]);
        app.log("스켈레톤 생성 완료:", skeleton);
        
        if (skeleton) {
            // 메시에 스켈레톤 적용
            applySkeletonToMesh(handMeshClone, skeleton);
            app.log("메시에 스켈레톤 적용 완료");
        }
        
        // 현재 손 포즈를 애니메이션으로 저장
        const animations = createPoseAnimation(app.handBonesMap[handIndex]);
        app.log("애니메이션 생성 완료:", animations);
        
        // GLTFExporter 생성
        const exporter = new THREE.GLTFExporter();
        
        // 내보내기 옵션 설정
        const options = {
            binary: true,
            animations: animations,
            includeCustomExtensions: true,
            onlyVisible: true,
            embedImages: true
        };
        
        app.log("GLB 내보내기 시작...");
        
        // 내보내기 실행
        exporter.parse(exportScene, function(result) {
            app.log("내보내기 완료, 파일 저장 중...");
            
            // GLB 파일로 저장
            const filename = `rigged_hand_${handIndex}_${new Date().getTime()}.glb`;
            saveArrayBuffer(result, filename);
            
            alert(`파일 "${filename}" 내보내기 완료!`);
        }, function(error) {
            console.error("내보내기 중 오류 발생:", error);
            alert("GLB 내보내기 중 오류가 발생했습니다. 콘솔을 확인하세요.");
        }, options);
        
    } catch (error) {
        console.error("손 메쉬 내보내기 중 오류 발생:", error);
        alert("내보내기 중 오류가 발생했습니다: " + error.message);
    }
    
    function saveArrayBuffer(buffer, filename) {
        try {
            const blob = new Blob([buffer], {type: 'application/octet-stream'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            
            // URL 객체 정리
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
            
            app.log(`파일 "${filename}" 저장 완료`);
        } catch (error) {
            console.error("파일 저장 중 오류 발생:", error);
            alert("파일 저장 중 오류가 발생했습니다: " + error.message);
        }
    }
};

// 간단한 GLB 내보내기 함수 (버그 디버깅용)
app.exportSimpleGLB = function(handIndex) {
    if (!app.handMeshes3D || !app.handMeshes3D[handIndex]) {
        console.error(`손 메쉬 ${handIndex}가 존재하지 않습니다`);
        return;
    }
    
    if (typeof THREE.GLTFExporter === 'undefined') {
        console.error("THREE.GLTFExporter가 정의되지 않았습니다");
        alert("THREE.GLTFExporter가 로드되지 않았습니다. GLTFExporter.js 스크립트를 추가하세요.");
        return;
    }
    
    try {
        // 메쉬 복제
        const meshClone = app.handMeshes3D[handIndex].clone();
        
        // 간단한 씬 생성
        const tempScene = new THREE.Scene();
        tempScene.add(meshClone);
        
        // GLTFExporter 생성 및 내보내기
        const exporter = new THREE.GLTFExporter();
        exporter.parse(tempScene, function(result) {
            const filename = `simple_hand_${handIndex}_${new Date().getTime()}.glb`;
            
            // 저장
            const blob = new Blob([result], {type: 'application/octet-stream'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            
            alert(`파일 "${filename}" 내보내기 완료!`);
        }, function(error) {
            console.error("간단한 내보내기 중 오류:", error);
            alert("간단한 GLB 내보내기 중 오류가 발생했습니다: " + error.message);
        }, {
            binary: true,
            onlyVisible: true
        });
    } catch (error) {
        console.error("간단한 내보내기 중 오류 발생:", error);
        alert("내보내기 중 오류가 발생했습니다: " + error.message);
    }
};

// 본 정보로부터 스켈레톤 생성 (수정 없음)
// 본 정보로부터 스켈레톤 생성
function createSkeletonFromBones(bonesMap) {
    // MediaPipe 랜드마크를 본 구조로 변환
    const bones = [];
    const boneInverses = [];
    
    // 루트 본 (손목)을 첫 번째로 추가
    if (bonesMap["wrist"]) {
        const rootBone = bonesMap["wrist"];
        bones.push(rootBone);
        
        // 루트 본의 역행렬 계산
        const inverseMatrix = new THREE.Matrix4().getInverse(
            new THREE.Matrix4().makeTranslation(
                rootBone.position.x,
                rootBone.position.y,
                rootBone.position.z
            )
        );
        boneInverses.push(inverseMatrix);
        
        // 나머지 본들을 추가
        for (let i = 1; i < app.landmarkToGLTFBone.length; i++) {
            const boneName = app.landmarkToGLTFBone[i];
            const bone = bonesMap[boneName];
            
            if (bone) {
                bones.push(bone);
                
                // 본의 역행렬 계산
                const inverseMatrix = new THREE.Matrix4().getInverse(
                    new THREE.Matrix4().makeTranslation(
                        bone.position.x,
                        bone.position.y,
                        bone.position.z
                    )
                );
                boneInverses.push(inverseMatrix);
            }
        }
    }
    
    // 스켈레톤 생성
    const skeleton = new THREE.Skeleton(bones, boneInverses);
    
    return skeleton;
}

// 메시에 스켈레톤 적용 (수정 없음)
// 메시에 스켈레톤 적용
function applySkeletonToMesh(mesh, skeleton) {
    // 메시의 모든 하위 요소를 순회하며 스켈레톤 적용
    mesh.traverse(function(object) {
        if (object.isMesh) {
            // 스키닝 정보 설정
            object.skeleton = skeleton;
            
            // 스키닝된 메시로 변환 (필요한 경우)
            if (!object.isSkinnedMesh) {
                const skinnedMesh = new THREE.SkinnedMesh(
                    object.geometry,
                    object.material
                );
                skinnedMesh.skeleton = skeleton;
                skinnedMesh.position.copy(object.position);
                skinnedMesh.quaternion.copy(object.quaternion);
                skinnedMesh.scale.copy(object.scale);
                
                // 부모 객체에 스키닝된 메시 추가
                if (object.parent) {
                    const parent = object.parent;
                    parent.remove(object);
                    parent.add(skinnedMesh);
                }
            }
        }
    });
}

// 현재 포즈를 애니메이션으로 생성
function createPoseAnimation(bonesMap) {
    const tracks = [];
    const boneNames = Object.keys(bonesMap);
    
    // 각 본에 대한 애니메이션 트랙 생성
    for (let i = 0; i < boneNames.length; i++) {
        const boneName = boneNames[i];
        const bone = bonesMap[boneName];
        
        if (bone) {
            // 위치 키프레임 트랙
            const positionKF = new THREE.VectorKeyframeTrack(
                `.bones[${i}].position`,
                [0, 1],  // 시작과 끝 시간 (0초, 1초)
                [
                    bone.position.x, bone.position.y, bone.position.z,
                    bone.position.x, bone.position.y, bone.position.z
                ]
            );
            
            // 회전 키프레임 트랙
            const rotationKF = new THREE.QuaternionKeyframeTrack(
                `.bones[${i}].quaternion`,
                [0, 1],
                [
                    bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w,
                    bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w
                ]
            );
            
            tracks.push(positionKF);
            tracks.push(rotationKF);
        }
    }
    
    // 애니메이션 클립 생성
    const clip = new THREE.AnimationClip("pose", 1, tracks);
    return [clip];
}

// 손 추적 일시 중지 및 재개 기능
app.isPaused = false;

app.togglePause = function() {
    app.isPaused = !app.isPaused;
    
    // UI 업데이트
    const pauseBtn = document.getElementById('pauseTrackingBtn');
    if (pauseBtn) {
        pauseBtn.textContent = app.isPaused ? '추적 재개' : '추적 일시 중지';
    }
    
    return app.isPaused;
};

// UI 생성 함수 - 위치 조정
app.createExportUI = function() {
    // 디버그 버튼 먼저 생성
    const debugBtn = document.createElement('button');
    debugBtn.id = 'toggleDebugBtn';
    debugBtn.textContent = '디버그 로그 켜기/끄기';
    debugBtn.style = "position: fixed; top: 10px; right: 340px; padding: 10px; background-color: rgba(0, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    debugBtn.addEventListener('click', function() {
        app.debug = !app.debug;
        alert(app.debug ? "디버그 로그가 활성화되었습니다." : "디버그 로그가 비활성화되었습니다.");
    });
    document.body.appendChild(debugBtn);
    
    // 일시 중지 버튼 - 위치 조정
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pauseTrackingBtn';
    pauseBtn.textContent = '추적 일시 중지';
    pauseBtn.style = "position: fixed; top: 10px; right: 500px; padding: 10px; background-color: rgba(0, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    pauseBtn.addEventListener('click', app.togglePause);
    document.body.appendChild(pauseBtn);
    
    // 내보내기 버튼 - 위치 조정
    const exportLeftBtn = document.createElement('button');
    exportLeftBtn.id = 'exportRiggedLeftHandBtn';
    exportLeftBtn.textContent = '리깅 포함 왼손 내보내기';
    exportLeftBtn.style = "position: fixed; bottom: 50px; right: 10px; padding: 10px; background-color: rgba(0, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    exportLeftBtn.addEventListener('click', function() {
        console.log("왼손 내보내기 버튼 클릭됨");
        app.exportHandMeshWithRigging(0);
    });
    document.body.appendChild(exportLeftBtn);
    
    const exportRightBtn = document.createElement('button');
    exportRightBtn.id = 'exportRiggedRightHandBtn';
    exportRightBtn.textContent = '리깅 포함 오른손 내보내기';
    exportRightBtn.style = "position: fixed; bottom: 90px; right: 10px; padding: 10px; background-color: rgba(0, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    exportRightBtn.addEventListener('click', function() {
        console.log("오른손 내보내기 버튼 클릭됨");
        app.exportHandMeshWithRigging(1);
    });
    document.body.appendChild(exportRightBtn);
    
    // 간단한 내보내기 버튼 (디버깅용)
    const simpleExportLeftBtn = document.createElement('button');
    simpleExportLeftBtn.id = 'simpleExportLeftHandBtn';
    simpleExportLeftBtn.textContent = '간단한 왼손 내보내기';
    simpleExportLeftBtn.style = "position: fixed; bottom: 130px; right: 10px; padding: 10px; background-color: rgba(255, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    simpleExportLeftBtn.addEventListener('click', function() {
        console.log("간단한 왼손 내보내기 버튼 클릭됨");
        app.exportSimpleGLB(0);
    });
    document.body.appendChild(simpleExportLeftBtn);
    
    const simpleExportRightBtn = document.createElement('button');
    simpleExportRightBtn.id = 'simpleExportRightHandBtn';
    simpleExportRightBtn.textContent = '간단한 오른손 내보내기';
    simpleExportRightBtn.style = "position: fixed; bottom: 170px; right: 10px; padding: 10px; background-color: rgba(255, 0, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
    simpleExportRightBtn.addEventListener('click', function() {
        console.log("간단한 오른손 내보내기 버튼 클릭됨");
        app.exportSimpleGLB(1);
    });
    document.body.appendChild(simpleExportRightBtn);
};

// export.js 파일에 추가할 코드

// OBJ 형식으로 손 메쉬를 내보내는 함수
app.exportHandMeshAsOBJ = async function(handIndex) {
    app.log(`OBJ 형식으로 손 메쉬 내보내기 시작 (handIndex: ${handIndex})`);
    
    // 손 메쉬 존재 여부 검사
    if (!app.handMeshes3D || !app.handMeshes3D[handIndex]) {
        console.error(`app.handMeshes3D[${handIndex}]가 정의되지 않았습니다`);
        return;
    }
    
    try {
        // 동적으로 OBJExporter 가져오기
        const module = await import('https://unpkg.com/three@0.152.2/examples/jsm/exporters/OBJExporter.js');
        const OBJExporter = module.OBJExporter;
        
        // 메쉬 복제
        const handMeshClone = app.handMeshes3D[handIndex].clone();
        
        // 임시 씬 생성
        const tempScene = new THREE.Scene();
        tempScene.add(handMeshClone);
        
        // OBJ 내보내기
        const exporter = new OBJExporter();
        const result = exporter.parse(tempScene);
        
        // 파일 저장
        const filename = `hand_${handIndex}_${new Date().getTime()}.obj`;
        const blob = new Blob([result], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        
        // URL 객체 정리
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
        
        console.log(`OBJ 파일 "${filename}" 저장 완료`);
        alert(`파일 "${filename}" 내보내기 완료!`);
    } catch (error) {
        console.error("OBJ 내보내기 중 오류 발생:", error);
        alert("OBJ 내보내기 중 오류가 발생했습니다: " + error.message);
    }
};


// UI에 OBJ 내보내기 버튼 추가 (app.createExportUI 함수 내에 추가)
const exportLeftObjBtn = document.createElement('button');
exportLeftObjBtn.id = 'exportObjLeftHandBtn';
exportLeftObjBtn.textContent = 'OBJ로 왼손 내보내기';
exportLeftObjBtn.style = "position: fixed; bottom: 210px; right: 10px; padding: 10px; background-color: rgba(255, 165, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
exportLeftObjBtn.addEventListener('click', function() {
    console.log("OBJ 왼손 내보내기 버튼 클릭됨");
    app.exportHandMeshAsOBJ(0);
});
document.body.appendChild(exportLeftObjBtn);

const exportRightObjBtn = document.createElement('button');
exportRightObjBtn.id = 'exportObjRightHandBtn';
exportRightObjBtn.textContent = 'OBJ로 오른손 내보내기';
exportRightObjBtn.style = "position: fixed; bottom: 250px; right: 10px; padding: 10px; background-color: rgba(255, 165, 0, 0.7); color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100;";
exportRightObjBtn.addEventListener('click', function() {
    console.log("OBJ 오른손 내보내기 버튼 클릭됨");
    app.exportHandMeshAsOBJ(1);
});
document.body.appendChild(exportRightObjBtn);

// export.js 파일에 간단한 내보내기 함수 추가

// 네임스페이스 확인
window.app = window.app || {};

// 손 메쉬를 GLB로 내보내는 단순 함수
app.exportHandMeshSimple = function(handIndex) {
    console.log(`손 메쉬 내보내기 시작 (handIndex: ${handIndex})`);
    
    // 손 메쉬 존재 여부 검사
    if (!app.handMeshes3D || !app.handMeshes3D[handIndex]) {
        console.error(`손 메쉬 ${handIndex}가 존재하지 않습니다`);
        alert("손이 감지되지 않았습니다. 화면에 손을 보여주고 다시 시도하세요.");
        return;
    }
    
    try {
        // 메쉬 복제
        const handMeshClone = app.handMeshes3D[handIndex].clone();
        
        // 임시 씬 생성
        const tempScene = new THREE.Scene();
        tempScene.add(handMeshClone);
        
        // GLTFExporter 사용
        const exporter = new THREE.GLTFExporter();
        const options = {
            binary: true, // GLB 형식으로 내보내기
            onlyVisible: true
        };
        
        // 내보내기 실행
        exporter.parse(
            tempScene, 
            function(result) {
                // 성공 콜백
                const filename = `hand_${handIndex}_${new Date().getTime()}.glb`;
                const blob = new Blob([result], {type: 'application/octet-stream'});
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.click();
                
                // URL 객체 정리
                setTimeout(() => URL.revokeObjectURL(link.href), 100);
                
                alert(`파일 "${filename}" 내보내기 완료!`);
            },
            function(error) {
                // 오류 콜백
                console.error("내보내기 중 오류:", error);
                alert("GLB 내보내기 중 오류가 발생했습니다: " + error.message);
            },
            options
        );
    } catch (error) {
        console.error("내보내기 중 오류 발생:", error);
        alert("내보내기 과정에서 오류가 발생했습니다: " + error.message);
    }
};

// 기존 UI에 버튼 추가하는 함수
app.addExportButtons = function() {
    // 간단한 내보내기 버튼 (왼손)
    const exportLeftBtn = document.createElement('button');
    exportLeftBtn.textContent = '왼손 내보내기 (간단)';
    exportLeftBtn.style = "position: fixed; top: 260px; right: 10px; padding: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000;";
    exportLeftBtn.onclick = function() {
        console.log("왼손 내보내기 버튼 클릭됨");
        app.exportHandMeshSimple(0);
    };
    document.body.appendChild(exportLeftBtn);
    
    // 간단한 내보내기 버튼 (오른손)
    const exportRightBtn = document.createElement('button');
    exportRightBtn.textContent = '오른손 내보내기 (간단)';
    exportRightBtn.style = "position: fixed; top: 310px; right: 10px; padding: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000;";
    exportRightBtn.onclick = function() {
        console.log("오른손 내보내기 버튼 클릭됨");
        app.exportHandMeshSimple(1);
    };
    document.body.appendChild(exportRightBtn);
    
    console.log("내보내기 버튼 추가 완료");
};

// 페이지 로드 완료 후 버튼 추가
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(app.addExportButtons, 1000); // 1초 후 버튼 추가
});

// 손 랜드마크 데이터 추출 및 본 구조 추가 함수
function extractHandLandmarkDataWithBones(handIndex) {
  const joints = window.app.fingerJoints[handIndex];
  
  // 손 관절 위치 추출
  const landmarks = joints.map(joint => ({
    position: {
      x: joint.position.x,
      y: joint.position.y,
      z: joint.position.z
    }
  }));
  
  // 손가락 관절 연결 정의 (본 구조로 사용)
  const boneStructure = [
    // 엄지 손가락 체인
    { name: "thumb_cmc", parent: 0, child: 1 },
    { name: "thumb_mcp", parent: 1, child: 2 },
    { name: "thumb_ip", parent: 2, child: 3 },
    { name: "thumb_tip", parent: 3, child: 4 },
    
    // 검지 손가락 체인
    { name: "index_mcp", parent: 0, child: 5 },
    { name: "index_pip", parent: 5, child: 6 },
    { name: "index_dip", parent: 6, child: 7 },
    { name: "index_tip", parent: 7, child: 8 },
    
    // 중지 손가락 체인
    { name: "middle_mcp", parent: 0, child: 9 },
    { name: "middle_pip", parent: 9, child: 10 },
    { name: "middle_dip", parent: 10, child: 11 },
    { name: "middle_tip", parent: 11, child: 12 },
    
    // 약지 손가락 체인
    { name: "ring_mcp", parent: 0, child: 13 },
    { name: "ring_pip", parent: 13, child: 14 },
    { name: "ring_dip", parent: 14, child: 15 },
    { name: "ring_tip", parent: 15, child: 16 },
    
    // 소지 손가락 체인
    { name: "pinky_mcp", parent: 0, child: 17 },
    { name: "pinky_pip", parent: 17, child: 18 },
    { name: "pinky_dip", parent: 18, child: 19 },
    { name: "pinky_tip", parent: 19, child: 20 },
    
    // 손바닥 연결
    { name: "palm_index_middle", parent: 5, child: 9 },
    { name: "palm_middle_ring", parent: 9, child: 13 },
    { name: "palm_ring_pinky", parent: 13, child: 17 }
  ];
  
  // 손가락 관절 연결 (선으로 표시되는 부분)
  const connections = boneStructure.map(bone => [bone.parent, bone.child]);
  
  // 랜드마크와 본 정보를 포함한 데이터
  return {
    handIndex: handIndex, // 0=왼손, 1=오른손
    landmarks: landmarks,
    connections: connections,
    bones: boneStructure,
    jointNames: [
      "wrist",
      "thumb_cmc", "thumb_mcp", "thumb_ip", "thumb_tip", 
      "index_mcp", "index_pip", "index_dip", "index_tip", 
      "middle_mcp", "middle_pip", "middle_dip", "middle_tip", 
      "ring_mcp", "ring_pip", "ring_dip", "ring_tip", 
      "pinky_mcp", "pinky_pip", "pinky_dip", "pinky_tip"
    ],
    metadata: {
      exportTime: new Date().toISOString(),
      format: "MediaPipe Hand Landmarks with Bone Structure",
      version: "1.0"
    }
  };
}