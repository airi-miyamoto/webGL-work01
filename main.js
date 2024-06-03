import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// DOMが読み込まれたらWebGLを始動
window.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('#web-gl');
  const app = new ThreeApp(wrapper);

  const launchButton = document.querySelector('#launch');

  //ボタンのイベントリスナーを設定
  launchButton.addEventListener('click', () => {
    if (app.fireWorkArray.length < 20) {
      app.createFireWork();
    }
    
  });

  //描画
  app.render();
}, false);

// three.jsを効率よく扱うためのクラス
class ThreeApp {

  //カメラ定義のための定数
  static CAMERA_PARAM = {
    fovy: 80, //カメラの写す縦の角度
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 200.0,
    position: new THREE.Vector3(80.0, 0.0, 80.0),
    lookAt: new THREE.Vector3(0.0, 80.0, 0.0),
  };

  //レンダラー定義のための定数
  static RENDERER_PARAM = {
    clearColor: 0x0000000, //画面をクリアする色
    width: window.innerWidth,
    height: window.innerHeight,
  };

  //平行光源定義のための定数
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff, //光の色
    intensity: 1.0,  //光の強度
    position: new THREE.Vector3(1.0, 1.0, 1.0), //光の向き（この座標から原点へ向かうベクトル）
  };

  // アンビエントライト（環境光）定義のための定数
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff, //光の色
    intensity: 0.7, //光の強度
  };

  //マテリアル定義のための定数
  static MATERIAL_PARAM = {
    color: 0x3399ff,
  };

  //フォグの定義のための定数
  static FOG_PARAM = {
    color: 0xffffff, //フォグの色
    near: 300.0, //フォグがかかり始めるカメラからの距離
    far: -100.0 //フォグが完全にかかるカメラからの距離
  };


  renderer;
  scene;
  camera;
  directionalLight; //平行光源
  ambientLight;     //環境光
  material;   // マテリアル
  boxGeometry;   // ボックスジオメトリ
  fireWorkArray = []; //花火の配列
  controls;   //オービットコントロール
  composer; //ポストプロセッシング用のcomposer
  renderPass; //レンダーパス
  unrealBloomPass;//unlrealBloomPass;
  axesHelper; //軸ヘルパー
  tick; //アニメーション進捗管理用 経過フレーム
  launchTime; //打ち上げ時間
  explodeTime; //広がり時間
  fallTime; //落ちる時間

  constructor(wrapper) {
    //レンダラの初期化
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    //クリアする色を指定
    this.renderer.setClearColor(color);
    //レンダリングするサイズを指定
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    //＃web-glのdivの中にcanvas要素を生成
    wrapper.appendChild(this.renderer.domElement);

    //シーンの初期化
    this.scene = new THREE.Scene();

    //フォグ
    this.scene.fog = new THREE.Fog(
      ThreeApp.FOG_PARAM.color,
      ThreeApp.FOG_PARAM.near,
      ThreeApp.FOG_PARAM.far
    );

    //カメラの初期化
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    // カメラの位置を指定
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    // カメラを原点方向に向かせる
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト(平行光源)
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
    this.scene.add(this.directionalLight);

    //アンビエントライト(環境光)
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity
    );
    this.scene.add(this.ambientLight);


    //軸ヘルパー
    // const axesBarLength = 50;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);


    //コントロールの設定
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    //renderのthisのバインド
    this.render = this.render.bind(this);


    //コンポーザーの設定
    this.composer = new EffectComposer(this.renderer);
    //RenderPassを追加
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    //UnrealBloomPassを追加
    this.unrealBloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      8.0, //強度
      1.0, //半径
      0.7, //しきい値
    );
    this.composer.addPass(this.unrealBloomPass);
    this.unrealBloomPass.renderToScreen = true;


    this.launchTime = 100;
    this.explodeTime = 80;
    this.fallTime = 250;


    //リサイズイベント
    window.addEventListener('resize', () => {
      //レンダラの大きさを設定
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      //カメラが撮影する視錐台のアスペクト比を再設定
      this.camera.aspect = window.innerWidth / window.innerHeight;
      //カメラのパラメータが変更されたときは行列を更新する
      this.camera.updateProjectionMatrix();
    }, false);

  }
  /**
   * 花火を生成
   */
  createFireWork() {
    this.boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const boxCount = 200;
    const randomColor = new THREE.Color(Math.random(), Math.random(), Math.random());
    const material = new THREE.MeshPhongMaterial({
      color: randomColor,
      emissive: randomColor,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 1
    });

    let launchPosition = new THREE.Vector3(Math.random() * 200 - 100, 0, Math.random() * 200 - 100);
    let fireWork = new THREE.Group();
    fireWork.userData.tick = 0;
    fireWork.userData.state = 'launch';
    fireWork.userData.launchTime = this.launchTime;
    fireWork.userData.explodeTime = this.explodeTime;
    fireWork.userData.fallTime = this.fallTime;

    for (let i = 0; i < boxCount; ++i) {
      //ボックスメッシュのインスタンスを生成
      const box = new THREE.Mesh(this.boxGeometry, material);
      box.position.copy(launchPosition);

      //ランダムな方向を設置
      const radius = 20;
      const theta = Math.random() * 2 * Math.PI; // 0から2PIの間のランダムな角度(xy平面上)
      const phi = Math.acos(2 * Math.random() - 1); // 0からPIの間のランダムな角度(z軸)

      box.userData.targetPosition = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      box.userData.state = 'launch';
      fireWork.add(box);
    }
    this.scene.add(fireWork);
    this.fireWorkArray.push(fireWork);
  }


  /**
   * 打ち上げアニメーション
   */

  launchAnimation() {
    const fireWorksToRemove = []; //アニメーションが終わった花火を削除する配列
    this.fireWorkArray.forEach((fireWork) => {

      fireWork.userData.tick++;

      fireWork.children.forEach((box) => {
        if (box.userData.state === 'launch') {
          const distance = 50;
          let progress = Math.min(1, fireWork.userData.tick / fireWork.userData.launchTime);
          box.position.y = distance * this.easeOutQuart(progress);

          if (progress >= 1) {
            box.userData.state = 'explode'; //状態を広がるに変更
            box.userData.startTick = fireWork.userData.tick; //広がりの開始時刻を記録
          }
        }
        else if (box.userData.state === 'explode') {
          let explosionProgress = (fireWork.userData.tick - box.userData.startTick) / fireWork.userData.explodeTime;
          if (explosionProgress < 1) {
            const direction = box.userData.targetPosition.clone().normalize();
            box.position.add(direction.multiplyScalar(this.easeOutQuint(explosionProgress) * 0.4));
          } else {
            box.userData.currentPosition = box.position.clone(); //現在の位置を記録
            box.userData.state = 'fall'; //状態を落ちるに変更
            box.userData.startTick = fireWork.userData.tick;
          }
        } else if (box.userData.state === 'fall') {
          let fallProgress = (fireWork.userData.tick - box.userData.startTick) / fireWork.userData.fallTime;
          if (fallProgress < 1) {
            if (box.userData.currentPosition) {
              box.position.y = box.userData.currentPosition.y - this.easeOutQuart(fallProgress) * 10;
              box.material.opacity = 1 - fallProgress * 2; //透明度を調整
              if (box.material.opacity <= 0) {
                box.material.opacity = 0;
              }
            }
          } else {
            fireWorksToRemove.push(fireWork);
          }
        }
      });
    });

    //アニメーションが終了した花火をシーンから削除
    if(fireWorksToRemove.length > 1) {
      fireWorksToRemove.forEach((fireWork) => {
        this.scene.remove(fireWork);
        this.fireWorkArray = this.fireWorkArray.filter(fw => fw !== fireWork);
      });
    }
  }


  /**
   * 描画処理
   */
  render() {
    //アニメーションループの設定
    requestAnimationFrame(this.render);
    this.controls.update();

    this.launchAnimation();

    this.composer.render();
  }

  easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
  }

  easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
  }
}