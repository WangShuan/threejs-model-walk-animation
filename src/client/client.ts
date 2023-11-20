import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'dat.gui'
import TWEEN from '@tweenjs/tween.js'

const scene = new THREE.Scene()
scene.add(new THREE.AxesHelper(5))

const light1 = new THREE.SpotLight(0xffffff, 100);
light1.position.set(2.5, 5, 2.5)
light1.angle = Math.PI / 8
light1.penumbra = 0.5
light1.castShadow = true;
light1.shadow.mapSize.width = 1024;
light1.shadow.mapSize.height = 1024;
light1.shadow.camera.near = 0.5;
light1.shadow.camera.far = 20
scene.add(light1)

const light2 = new THREE.SpotLight(0xffffff, 100);
light2.position.set(-2.5, 5, 2.5)
light2.angle = Math.PI / 8
light2.penumbra = 0.5
light2.castShadow = true;
light2.shadow.mapSize.width = 1024;
light2.shadow.mapSize.height = 1024;
light2.shadow.camera.near = 0.5;
light2.shadow.camera.far = 20
scene.add(light2)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0.8, 1.4, 1.0)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 1, 0)

const sceneMeshes: THREE.Mesh[] = []

const planeGeometry = new THREE.PlaneGeometry(25, 25)
const plane = new THREE.Mesh(planeGeometry, new THREE.MeshPhongMaterial())
plane.rotateX(-Math.PI / 2)
plane.receiveShadow = true
scene.add(plane)
sceneMeshes.push(plane)

let mixer: THREE.AnimationMixer
let modelReady = false
let modelMesh: THREE.Object3D
const animationActions: THREE.AnimationAction[] = []
let activeAction: THREE.AnimationAction
let lastAction: THREE.AnimationAction
const gltfLoader = new GLTFLoader()

// 載入模型
gltfLoader.load(
  'models/Kachujin.glb',
  (gltf) => {
    gltf.scene.traverse(function (child) {
      if ((child as THREE.Mesh).isMesh) {
        let m = child as THREE.Mesh
        m.castShadow = true // 開啟模型陰影
        m.frustumCulled = false // 這個可以讓相機貼著模型時維持模型渲染(默認相機碰到模型時，模型會停止渲染)
      }
    })

    mixer = new THREE.AnimationMixer(gltf.scene)

    const animationAction = mixer.clipAction((gltf as any).animations[0])
    animationActions.push(animationAction)
    animationsFolder.add(animations, 'default')
    activeAction = animationActions[0]

    scene.add(gltf.scene)
    modelMesh = gltf.scene

    gltfLoader.load(
      'models/Kachujin@kick.glb',
      (gltf) => {
        console.log('loaded kick')
        const animationAction = mixer.clipAction(
          (gltf as any).animations[0]
        )
        animationActions.push(animationAction)
        animationsFolder.add(animations, 'kick')

        gltfLoader.load(
          'models/Kachujin@walking.glb',
          (gltf) => {
            // 取消前後左右位移，讓動畫在原地執行
            (gltf as any).animations[0].tracks.shift()

            const animationAction = mixer.clipAction(
              (gltf as any).animations[0]
            )
            animationActions.push(animationAction)
            animationsFolder.add(animations, 'walking')

            modelReady = true
          },
          (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
          },
          (error) => {
            console.log(error)
          }
        )
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
      },
      (error) => {
        console.log(error)
      }
    )
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
  },
  (error) => {
    console.log(error)
  }
)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  render()
}

const raycaster = new THREE.Raycaster();
const targetQuaternion = new THREE.Quaternion()

renderer.domElement.addEventListener('dblclick', onDoubleClick, false)
const mouse = new THREE.Vector2()

function onDoubleClick(event: MouseEvent) {
  mouse.set(
    (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
    -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
  )

  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObjects(sceneMeshes, false)

  if (intersects.length > 0) {

    const p = intersects[0].point

    // 獲取物件到點擊處的距離
    const distance = modelMesh.position.distanceTo(p)

    // 讓角色在移動前，面向要去的地方
    const rotationMatrix = new THREE.Matrix4()
    // 使用 lookAt 傳入目標點、起點、物件的 up 屬性，設置一個變換
    rotationMatrix.lookAt(p, modelMesh.position, modelMesh.up)
    // 通過 setFromRotationMatrix 設定 rotationMatrix 變換的旋轉
    targetQuaternion.setFromRotationMatrix(rotationMatrix)

    // 設定成走路動作
    setAction(animationActions[2])

    TWEEN.removeAll() // 避免快速重複 dblclick 時，走路的動畫跑不出來
    new TWEEN.Tween(modelMesh.position) // 讓物件移動到點擊的位置
      .to({
        x: p.x,
        y: p.y,
        z: p.z
      }, 1000 / 2 * distance) // 根據距離調整動畫的速度
      .onUpdate(() => {
        // 讓相機跟著物件移動
        controls.target.set(modelMesh.position.x, modelMesh.position.y + 1, modelMesh.position.z)
        // 讓燈光跟著物件移動
        light1.target = modelMesh
        light2.target = modelMesh
      })
      .start()
      .onComplete(() => {
        setAction(animationActions[1]) // 將走路動作改成踢的動作
        activeAction.clampWhenFinished = true // 讓動畫在最後一幀停止
        activeAction.loop = THREE.LoopOnce // 讓動畫僅執行一次
      })
  }
}

const stats = new Stats()
document.body.appendChild(stats.dom)

const animations = {
  default: function () {
    setAction(animationActions[0])
  },
  kick: function () {
    setAction(animationActions[1])
  },
  walking: function () {
    setAction(animationActions[2])
  },
}

const setAction = (toAction: THREE.AnimationAction) => {
  if (toAction != activeAction) {
    lastAction = activeAction
    activeAction = toAction
    lastAction.fadeOut(0.2)
    activeAction.reset()
    activeAction.fadeIn(0.2)
    activeAction.play()
  }
}
const gui = new GUI()
const animationsFolder = gui.addFolder('Animations')
animationsFolder.open()


const clock = new THREE.Clock()
let delta = 0

function animate() {
  requestAnimationFrame(animate)

  controls.update()

  if (modelReady) {
    delta = clock.getDelta()
    mixer.update(delta)

    if (!modelMesh.quaternion.equals(targetQuaternion)) {
      modelMesh.quaternion.rotateTowards(targetQuaternion, delta * 10)
    }
  }

  TWEEN.update()

  render()

  stats.update()
}

function render() {
  renderer.render(scene, camera)
}

animate()
