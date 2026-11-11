// All clickable objects, their animations and the UI wiring.

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const lerp = (a, b, t) => a + (b - a) * t;

export function createInteractions(ctx) {
  const {
    THREE, scene, room, camera, controls, renderer, outline, bloom,
    lights, mats, tex, DAY_BG, NIGHT_BG, HOME_TARGET, HOME_DIR, homeDistance, onFrame,
  } = ctx;

  const get = (name) => room.getObjectByName(name);

  // ------------------------------------------------------------ tweens
  const tweens = new Set();
  function tween(duration, update, ease = easeInOut) {
    return new Promise((resolve) => tweens.add({ start: performance.now(), duration, update, ease, resolve }));
  }
  onFrame(() => {
    const now = performance.now();
    for (const tw of tweens) {
      const p = Math.min(1, (now - tw.start) / tw.duration);
      tw.update(tw.ease(p), p);
      if (p === 1) { tweens.delete(tw); tw.resolve(); }
    }
  });
  /** Tween a numeric property from its current value */
  function to(obj, key, value, duration = 600, ease) {
    const from = obj[key];
    return tween(duration, (e) => { obj[key] = lerp(from, value, e); }, ease);
  }

  // ------------------------------------------------------------ helpers
  /** Wrap existing scene objects in a new group whose pivot is `pivot` */
  function regroup(name, names, pivot) {
    const g = new THREE.Group();
    g.name = name;
    g.position.copy(pivot);
    const parent = get(names[0]).parent;
    parent.add(g);
    g.updateMatrixWorld(true);
    names.forEach((n) => { const o = get(n); if (o) g.attach(o); });
    return g;
  }
  const whiteMat = mats.Furniture_White;

  // ------------------------------------------------------------ state
  const state = {
    night: false,
    led: true,
    softbox: true,
    logo: true,
    ac: false,
    blind: false,
    screen: 0, // 0 city, 1 code, 2 off
    vScreen: true,
    chairTucked: false,
    hpLifted: false,
    kbRGB: false,
    rgb: '#ff1f3d',
    drawers: [false, false, false],
  };

  // ------------------------------------------------------------ drawers
  // Drawer fronts are separate meshes: give each a tray so it can slide out.
  const drawers = [0, 1, 2].map((i) => {
    const front = get(`Drawer_Front_${i}`);
    const g = regroup(`Drawer_${i}`, [`Drawer_Front_${i}`, `Drawer_Handle_${i}`], front.position.clone());
    const tray = new THREE.Group();
    const parts = [
      [0.5, 0.012, 0.4, -0.26, -0.075, 0],
      [0.5, 0.14, 0.012, -0.26, -0.01, 0.194],
      [0.5, 0.14, 0.012, -0.26, -0.01, -0.194],
      [0.012, 0.14, 0.4, -0.51, -0.01, 0],
    ];
    parts.forEach(([w, h, d, x, y, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
      tray.add(m);
    });
    const stuffColors = [[0xb3122e, 0x2a2a30, 0xe8e8e8], [0x3a3f4a, 0xd9a441, 0xffffff], [0x1f1f24, 0xb3122e, 0x9aa0a8]][i];
    stuffColors.forEach((c, k) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 + k * 0.03, 0.025 + k * 0.015, 0.1 + (k % 2) * 0.12),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }),
      );
      m.position.set(-0.12 - k * 0.13, -0.055 + k * 0.006, (k - 1) * 0.1);
      m.rotation.y = (k - 1) * 0.3;
      tray.add(m);
    });
    g.add(tray);
    return g;
  });

  // ------------------------------------------------------------ headphones lift group
  const hpRoot = get('Headphones');
  const hpLift = new THREE.Group();
  hpRoot.add(hpLift);
  ['HP_Band', 'HP_Cup_L', 'HP_Cup_R', 'HP_Pad_L', 'HP_Pad_R'].forEach((n) => hpLift.attach(get(n)));

  // ------------------------------------------------------------ plant group (pivot at pot base)
  const plantNames = [];
  room.traverse((o) => { if (/^Plant_(Leaf|Stem)/.test(o.name)) plantNames.push(o.name); });
  const plantFoliage = regroup('Plant_Foliage', plantNames, new THREE.Vector3(3.68, 0.33, -0.35));

  // ------------------------------------------------------------ AC airflow particles
  const AIR_N = 140;
  const airGeo = new THREE.BufferGeometry();
  const airPos = new Float32Array(AIR_N * 3);
  const airLife = new Float32Array(AIR_N).map(() => Math.random() * 2.4);
  const airVel = [];
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({
    color: 0xdff3ff, size: 0.035, transparent: true, opacity: 0, depthWrite: false,
  });
  const air = new THREE.Points(airGeo, airMat);
  air.frustumCulled = false;
  scene.add(air);
  function spawnAir(i) {
    airPos[i * 3] = 1.95 + Math.random() * 0.9;
    airPos[i * 3 + 1] = 2.38;
    airPos[i * 3 + 2] = -0.32;
    airVel[i] = [(Math.random() - 0.5) * 0.08, -0.25 - Math.random() * 0.2, -0.45 - Math.random() * 0.3];
    airLife[i] = 0;
  }
  for (let i = 0; i < AIR_N; i++) spawnAir(i);
  const acLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x33ff88, emissiveIntensity: 0 }),
  );
  acLed.position.set(2.86, 2.47, -0.262);
  scene.add(acLed);
  const louver = get('AC_Louver');
  const louverClosed = louver.rotation.x;

  // ------------------------------------------------------------ blind
  const fabric = get('Blind_Fabric');
  const fabricUp = { y: fabric.position.y, s: 1 };
  const fabricDown = { y: 1.545, s: 1.15 / 0.18 };

  // ------------------------------------------------------------ remember originals
  const chair = get('Office_Chair');
  const chairHome = chair.position.clone();
  const chairRotY = chair.rotation.y;
  const screenA = get('MonA_Screen').material;
  const screenB = get('MonB_Screen').material;
  const phoneScreen = get('Phone_Screen').material;
  const kbMat = get('KB_Key').material;
  const deckMats = [0, 1, 2].map((i) => get(`Deck_Btn_${i}`).material);
  const logoMat = mats.Logo_White;
  const ledMat = mats.LED_Warm;
  const rgbMat = mats.LED_Red;
  const softMat = mats.Softbox_White;
  const outdoor = get('Win_Outdoor').material;

  // ------------------------------------------------------------ actions
  const actions = {
    setNight(on) {
      state.night = on;
      document.body.classList.toggle('night', on);
      const bgFrom = scene.background.clone();
      const bgTo = on ? NIGHT_BG : DAY_BG;
      tween(1200, (e) => scene.background.copy(bgFrom).lerp(bgTo, e));
      to(lights.hemi, 'intensity', on ? 0.1 : 0.7, 1200);
      to(lights.sun, 'intensity', on ? 0 : 1.5, 1200);
      to(lights.window, 'intensity', on ? 0.6 : (state.blind ? 1 : 5), 1200);
      to(lights.ceiling, 'intensity', on ? 1.6 : 0, 1200);
      to(scene, 'environmentIntensity', on ? 0.05 : 0.25, 1200);
      to(bloom, 'strength', on ? 0.8 : 0.35, 1200);
      to(bloom, 'threshold', on ? 0.9 : 1.8, 1200);
      outdoor.map = on ? tex.outdoorNight : tex.outdoorDay;
      outdoor.needsUpdate = true;
      document.querySelectorAll('#mode-seg button').forEach((b) =>
        b.classList.toggle('active', (b.dataset.mode === 'night') === on));
    },
    setLED(on) {
      state.led = on;
      to(ledMat, 'emissiveIntensity', on ? 3 : 0, 500);
      ['ledA', 'ledB', 'ledBase'].forEach((k) => to(lights[k], 'intensity', on ? (k === 'ledBase' ? 5 : 7) : 0, 500));
      document.getElementById('sw-led').checked = on;
    },
    setSoftbox(on) {
      state.softbox = on;
      to(softMat, 'emissiveIntensity', on ? 2.2 : 0, 350);
      to(lights.softbox, 'intensity', on ? 9 : 0, 350);
      document.getElementById('sw-softbox').checked = on;
    },
    setLogo(on) {
      state.logo = on;
      to(logoMat, 'emissiveIntensity', on ? 1.2 : 0, 500);
      to(lights.logo, 'intensity', on ? 1.6 : 0, 500);
      document.getElementById('sw-logo').checked = on;
    },
    setAC(on) {
      state.ac = on;
      to(louver.rotation, 'x', on ? louverClosed - 0.75 : louverClosed, 900);
      to(acLed.material, 'emissiveIntensity', on ? 3 : 0, 300);
      document.getElementById('sw-ac').checked = on;
    },
    setBlind(down) {
      state.blind = down;
      const target = down ? fabricDown : fabricUp;
      to(fabric.position, 'y', target.y, 1400);
      to(fabric.scale, 'y', target.s, 1400);
      if (!state.night) to(lights.window, 'intensity', down ? 1 : 5, 1400);
    },
    setRGB(color) {
      state.rgb = color;
      if (color !== 'rainbow') {
        const c = new THREE.Color(color);
        rgbMat.emissive.copy(c); rgbMat.color.copy(c);
        lights.pc.color.copy(c);
      }
      document.querySelectorAll('#rgb-swatches button').forEach((b) =>
        b.classList.toggle('active', b.dataset.color === color));
    },
    cycleScreen() {
      state.screen = (state.screen + 1) % 3;
      if (state.screen === 2) { to(screenA, 'emissiveIntensity', 0, 300); return; }
      screenA.emissiveMap = state.screen === 0 ? tex.city : tex.code;
      screenA.needsUpdate = true;
      screenA.emissiveIntensity = 0;
      to(screenA, 'emissiveIntensity', 1.1, 500);
    },
    toggleVScreen() {
      state.vScreen = !state.vScreen;
      to(screenB, 'emissiveIntensity', state.vScreen ? 0.9 : 0, 400);
    },
    async chair() {
      state.chairTucked = !state.chairTucked;
      const fromX = chair.position.x;
      const toX = state.chairTucked ? chairHome.x - 0.42 : chairHome.x;
      const r0 = chair.rotation.y;
      await tween(1300, (e) => {
        chair.position.x = lerp(fromX, toX, e);
        chair.rotation.y = lerp(r0, chairRotY + (state.chairTucked ? Math.PI * 2 : 0), e);
      });
      chair.rotation.y = chairRotY;
    },
    drawer(i) {
      state.drawers[i] = !state.drawers[i];
      const g = drawers[i];
      const base = get(`Drawer_${i}`).userData.baseX ?? (g.userData.baseX = g.position.x);
      to(g.position, 'x', state.drawers[i] ? base + 0.34 : base, 700, state.drawers[i] ? easeOutBack : easeInOut);
    },
    headphones() {
      state.hpLifted = !state.hpLifted;
      to(hpLift.position, 'y', state.hpLifted ? 0.2 : 0, 800, easeOutBack);
    },
    async plant() {
      await tween(2200, (_e, p) => {
        const d = Math.exp(-p * 4);
        plantFoliage.rotation.x = Math.sin(p * 28) * 0.09 * d;
        plantFoliage.rotation.z = Math.cos(p * 22) * 0.07 * d;
      }, (p) => p);
    },
    async hop(obj, height = 0.08) {
      if (obj.userData.hopping) return;
      obj.userData.hopping = true;
      const y0 = obj.position.y, r0 = obj.rotation.y;
      await tween(650, (_e, p) => {
        obj.position.y = y0 + Math.sin(p * Math.PI) * height;
        obj.rotation.y = r0 + Math.sin(p * Math.PI * 2) * 0.12;
      }, (p) => p);
      obj.position.y = y0; obj.rotation.y = r0;
      obj.userData.hopping = false;
    },
    async phone() {
      const ph = get('Phone_Stand');
      tex.phone.needsUpdate = true;
      to(phoneScreen, 'emissiveIntensity', 1.2, 200);
      const x0 = ph.position.x;
      await tween(500, (_e, p) => { ph.position.x = x0 + Math.sin(p * Math.PI * 12) * 0.004 * (1 - p); }, (p) => p);
      ph.position.x = x0;
      clearTimeout(actions._phoneTimer);
      actions._phoneTimer = setTimeout(() => to(phoneScreen, 'emissiveIntensity', 0, 600), 4000);
    },
    deck() {
      deckMats.forEach((m) => {
        m.emissive.setHSL(Math.random(), 0.9, 0.55);
        m.color.copy(m.emissive);
        m.emissiveIntensity = 3;
      });
    },
    async mouse() {
      const m = get('Mouse');
      const z0 = m.position.z, x0 = m.position.x;
      await tween(700, (_e, p) => {
        m.position.z = z0 + Math.sin(p * Math.PI * 4) * 0.03 * (1 - p);
        m.position.x = x0 + Math.sin(p * Math.PI * 2) * 0.02 * (1 - p);
      }, (p) => p);
      m.position.set(x0, m.position.y, z0);
    },
    keyboard() {
      state.kbRGB = !state.kbRGB;
      if (!state.kbRGB) { kbMat.emissiveIntensity = 0; }
    },
  };
  // Drawer base positions
  drawers.forEach((g) => { g.userData.baseX = g.position.x; });

  // ------------------------------------------------------------ per-frame effects
  onFrame((dt, t) => {
    // AC airflow
    airMat.opacity += ((state.ac ? 0.45 : 0) - airMat.opacity) * Math.min(1, dt * 3);
    if (airMat.opacity > 0.01) {
      for (let i = 0; i < AIR_N; i++) {
        airLife[i] += dt;
        if (airLife[i] > 2.4) { if (state.ac) spawnAir(i); continue; }
        const v = airVel[i];
        airPos[i * 3] += v[0] * dt;
        airPos[i * 3 + 1] += v[1] * dt;
        airPos[i * 3 + 2] += v[2] * dt;
      }
      airGeo.attributes.position.needsUpdate = true;
    }
    // Rainbow RGB
    if (state.rgb === 'rainbow') {
      rgbMat.emissive.setHSL((t * 0.15) % 1, 1, 0.5);
      rgbMat.color.copy(rgbMat.emissive);
      lights.pc.color.copy(rgbMat.emissive);
    }
    // gentle "breathing" on the PC glow
    lights.pc.intensity = 1.2 + Math.sin(t * 2) * 0.3;
    // Keyboard RGB wave
    if (state.kbRGB) {
      kbMat.emissive.setHSL((t * 0.25) % 1, 1, 0.5);
      kbMat.emissiveIntensity = 1.6;
    }
    // Floating headphones bob
    if (state.hpLifted) hpLift.rotation.y = Math.sin(t * 1.5) * 0.25;
    else hpLift.rotation.y *= 0.9;
  });

  // ------------------------------------------------------------ interactive items
  const slatNames = [];
  room.traverse((o) => { if (/^Slat_/.test(o.name)) slatNames.push(o.name); });

  const onOff = (v) => (v ? '<b>เปิด</b>' : '<b>ปิด</b>');
  const items = [
    {
      names: ['Monitor_Main'], tag: 'จอภาพ', title: 'จอ Ultrawide 34"',
      desc: 'จอหลักสำหรับทำงานและเล่นเกม พร้อมเว็บแคมด้านบน',
      hint: 'คลิกเพื่อเปลี่ยนหน้าจอ', action: actions.cycleScreen,
      state: () => `หน้าจอ: <b>${['ภาพเมืองยามค่ำ', 'โค้ดเอดิเตอร์', 'ปิด'][state.screen]}</b>`,
    },
    {
      names: ['Monitor_Vertical'], tag: 'จอภาพ', title: 'จอแนวตั้ง 27"',
      desc: 'จอหมุนแนวตั้งสำหรับดูแบบแปลนและเอกสารยาว',
      hint: 'คลิกเพื่อเปิด/ปิด', action: actions.toggleVScreen, state: () => `สถานะ: ${onOff(state.vScreen)}`,
    },
    {
      names: ['Office_Chair'], tag: 'เฟอร์นิเจอร์', title: 'เก้าอี้ Ergonomic',
      desc: 'เก้าอี้ตาข่ายระบายอากาศ มีพนักพิงศีรษะและที่วางแขนปรับได้',
      hint: 'คลิกเพื่อหมุนและเลื่อนเข้า/ออก', action: actions.chair,
      state: () => `ตำแหน่ง: <b>${state.chairTucked ? 'เลื่อนเข้าโต๊ะ' : 'ปกติ'}</b>`,
    },
    ...[0, 1, 2].map((i) => ({
      names: [`Drawer_${i}`], tag: 'ลิ้นชัก', title: `ลิ้นชักชั้นที่ ${i + 1}`,
      desc: 'ตู้ลิ้นชักใต้โต๊ะสำหรับเก็บเอกสารและอุปกรณ์',
      hint: 'คลิกเพื่อเปิด/ปิดลิ้นชัก', action: () => actions.drawer(i),
      state: () => `ลิ้นชัก: <b>${state.drawers[i] ? 'เปิดอยู่' : 'ปิดอยู่'}</b>`,
    })),
    {
      names: ['Gaming_PC'], tag: 'คอมพิวเตอร์', title: 'PC เคสกระจก RGB',
      desc: 'เคสกระจกนิรภัยพร้อมพัดลมไฟ RGB สีเข้ากับธีมห้อง',
      hint: 'คลิกเพื่อเปลี่ยนสีไฟ', action: () => {
        const order = ['#ff1f3d', '#19d3ff', '#a64dff', '#2bff88', 'rainbow'];
        actions.setRGB(order[(order.indexOf(state.rgb) + 1) % order.length]);
      },
      state: () => `สีไฟ: <b>${state.rgb === 'rainbow' ? 'รุ้ง' : state.rgb}</b>`,
    },
    {
      names: ['Softbox_Light'], tag: 'ไฟสตูดิโอ', title: 'ไฟ Softbox แปดเหลี่ยม',
      desc: 'ไฟส่องหน้าสำหรับไลฟ์สตรีมและประชุมวิดีโอ',
      hint: 'คลิกเพื่อเปิด/ปิดไฟ', action: () => actions.setSoftbox(!state.softbox), state: () => `ไฟ: ${onOff(state.softbox)}`,
    },
    {
      names: ['AC_Body', 'AC_Vent', 'AC_Louver', 'AC_Line'], tag: 'เครื่องใช้ไฟฟ้า', title: 'เครื่องปรับอากาศ',
      desc: 'แอร์ติดผนัง Inverter ตั้งไว้ 25°C',
      hint: 'คลิกเพื่อเปิด/ปิดแอร์', action: () => actions.setAC(!state.ac), state: () => `แอร์: ${onOff(state.ac)}`,
    },
    {
      names: ['Blind_Roll', 'Blind_Cover', 'Blind_Fabric', 'Blind_Cord'], tag: 'หน้าต่าง', title: 'ม่านม้วน',
      desc: 'ม่านม้วนกรองแสงสีขาว',
      hint: 'คลิกเพื่อดึงม่านขึ้น/ลง', action: () => actions.setBlind(!state.blind),
      state: () => `ม่าน: <b>${state.blind ? 'ดึงลง' : 'ม้วนเก็บ'}</b>`,
    },
    {
      names: ['Win_Glass', 'Win_Outdoor', 'Win_Frame_Top', 'Win_Frame_Bot', 'Win_Frame_L', 'Win_Frame_R', 'Win_Mullion', 'Win_Mullion2', 'Win_Handle', 'Win_Sill'],
      tag: 'หน้าต่าง', title: 'หน้าต่างบานเลื่อน',
      desc: 'มองเห็นต้นไม้ด้านนอก ให้แสงธรรมชาติตอนกลางวัน',
      hint: 'คลิกเพื่อสลับกลางวัน/กลางคืน', action: () => actions.setNight(!state.night),
      state: () => `เวลา: <b>${state.night ? 'กลางคืน' : 'กลางวัน'}</b>`,
    },
    {
      names: ['Logo_Text', 'Logo_Swoosh'], tag: 'ป้าย', title: 'ป้ายโลโก้ Supawit',
      desc: 'ป้ายตัวอักษรนูนพร้อมไฟ backlight',
      hint: 'คลิกเพื่อเปิด/ปิดไฟป้าย', action: () => actions.setLogo(!state.logo), state: () => `ไฟป้าย: ${onOff(state.logo)}`,
    },
    {
      names: ['LED_Strip_A', 'LED_Strip_B', 'LED_Base_Left', ...slatNames], tag: 'ตกแต่ง', title: 'ผนังระแนง + ไฟ LED',
      desc: 'ระแนงซับเสียงสีแดงเลือดหมู พร้อมไฟ LED วอร์มไวท์',
      hint: 'คลิกเพื่อเปิด/ปิดไฟ LED', action: () => actions.setLED(!state.led), state: () => `ไฟ LED: ${onOff(state.led)}`,
    },
    {
      names: ['Headphones'], tag: 'อุปกรณ์', title: 'หูฟังบนขาตั้ง',
      desc: 'หูฟังครอบหูสีขาวสำหรับประชุมและฟังเพลง',
      hint: 'คลิกเพื่อยกหูฟัง', action: actions.headphones,
      state: () => `หูฟัง: <b>${state.hpLifted ? 'ยกขึ้น' : 'อยู่บนขาตั้ง'}</b>`,
    },
    {
      names: ['Keyboard'], tag: 'อุปกรณ์', title: 'คีย์บอร์ด Mechanical',
      desc: 'คีย์บอร์ดเต็มไซซ์ สวิตช์เงียบ มีไฟ RGB ใต้ปุ่ม',
      hint: 'คลิกเพื่อเปิด/ปิดไฟ RGB', action: actions.keyboard, state: () => `ไฟ RGB: ${onOff(state.kbRGB)}`,
    },
    {
      names: ['Mouse'], tag: 'อุปกรณ์', title: 'เมาส์ไร้สาย',
      desc: 'เมาส์ไร้สายน้ำหนักเบา', hint: 'คลิกเพื่อขยับเมาส์', action: actions.mouse,
    },
    {
      names: ['Phone_Stand'], tag: 'อุปกรณ์', title: 'สมาร์ทโฟนบนแท่นชาร์จ',
      desc: 'แท่นชาร์จไร้สายแบบตั้งโต๊ะ', hint: 'คลิกเพื่อปลุกหน้าจอ', action: actions.phone,
    },
    {
      names: ['Stream_Deck', 'Deck_Btn_0', 'Deck_Btn_1', 'Deck_Btn_2'], tag: 'อุปกรณ์', title: 'Stream Deck',
      desc: 'ปุ่มลัดสำหรับควบคุมไลฟ์และแอปต่างๆ', hint: 'คลิกเพื่อเปลี่ยนสีปุ่ม', action: actions.deck,
    },
    {
      names: ['Laptop_Case', 'Laptop_Case_Band', 'Laptop_Case_Handle'], tag: 'ของใช้', title: 'กระเป๋าอะลูมิเนียม',
      desc: 'กระเป๋าใส่โน้ตบุ๊กและอุปกรณ์สำหรับเดินทาง', hint: 'คลิกเลย', action: () => actions.hop(caseGroup, 0.1),
    },
    {
      names: ['Plant_Foliage', 'Plant_Pot', 'Plant_Soil'], tag: 'ต้นไม้', title: 'ต้นไม้ในกระถาง',
      desc: 'ไม้ใบฟอกอากาศ เพิ่มความสดชื่นให้ห้อง', hint: 'คลิกเพื่อเขย่าใบ', action: actions.plant,
    },
    {
      names: ['Desk_Top', 'Drawer_Unit', 'Desk_Leg_Back', 'Desk_Leg_Front', 'Desk_Rail_Top', 'Desk_Rail_Bot', 'Desk_Rail_Side', 'Desk_Mat'],
      tag: 'เฟอร์นิเจอร์', title: 'โต๊ะทำงาน 225 × 75 ซม.',
      desc: 'โต๊ะท็อปขาว ขาเหล็ก พร้อมตู้ลิ้นชัก 3 ชั้น และแผ่นรองเมาส์ใหญ่',
      hint: 'ลองคลิกที่ลิ้นชักดูสิ', action: null,
    },
    {
      names: ['Sideboard_Body', 'Sideboard_Stripe', 'Sideboard_Stripe_End', 'Sideboard_Stripe_End2', 'Sideboard_Handle_0', 'Sideboard_Handle_1', 'Sideboard_Handle_2', 'Sideboard_Plinth', 'Sideboard_Gap_1', 'Sideboard_Gap_2'],
      tag: 'เฟอร์นิเจอร์', title: 'ตู้เก็บของ', desc: 'ตู้เตี้ยสีขาวคาดแถบแดง ใช้เก็บของและวางของตกแต่ง', action: null,
    },
  ];

  const caseGroup = regroup('Laptop_Case_Group', ['Laptop_Case', 'Laptop_Case_Band', 'Laptop_Case_Handle'], get('Laptop_Case').position.clone());

  const objToItem = new Map();
  items.forEach((it) => {
    it.objects = it.names.map(get).filter(Boolean);
    it.objects.forEach((o) => objToItem.set(o, it));
  });
  function itemFor(obj) {
    for (let o = obj; o; o = o.parent) if (objToItem.has(o)) return objToItem.get(o);
    return null;
  }

  // ------------------------------------------------------------ picking
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickable = [];
  room.traverse((o) => { if (o.isMesh) pickable.push(o); });
  const tooltip = document.getElementById('tooltip');
  let hovered = null;
  let pointerInside = false;
  let lastMove = { x: 0, y: 0 };

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    return hit ? itemFor(hit.object) : null;
  }

  function setHovered(it) {
    if (it === hovered) return;
    hovered = it;
    outline.selectedObjects = it ? it.objects : (selected ? selected.objects : []);
    document.body.classList.toggle('hovering', !!it);
    if (it) {
      tooltip.innerHTML = `${it.title}${it.hint ? `<small>${it.hint}</small>` : ''}`;
      tooltip.classList.add('show');
    } else tooltip.classList.remove('show');
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    pointerInside = true;
    lastMove = { x: e.clientX, y: e.clientY };
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top = `${e.clientY}px`;
  });
  canvas.addEventListener('pointerleave', () => { pointerInside = false; setHovered(null); });
  onFrame(() => {
    if (pointerInside && !down) setHovered(pick(lastMove.x, lastMove.y));
  });

  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', async (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const it = pick(e.clientX, e.clientY);
    if (!it) { closeCard(); return; }
    stopTour();
    hideHint();
    // Start the action, show the card right away, refresh it when the animation ends
    const running = it.action ? it.action() : null;
    showCard(it);
    await running;
    if (selected === it) showCard(it);
  });

  // ------------------------------------------------------------ info card
  const card = document.getElementById('card');
  let selected = null;
  function showCard(it) {
    selected = it;
    document.getElementById('card-tag').textContent = it.tag;
    document.getElementById('card-title').textContent = it.title;
    document.getElementById('card-desc').textContent = it.desc;
    document.getElementById('card-state').innerHTML = it.state ? it.state() : (it.hint ? `💡 ${it.hint}` : '');
    card.classList.add('show');
    if (!hovered) outline.selectedObjects = it.objects;
  }
  function refreshCard() { if (selected) showCard(selected); }
  function closeCard() {
    selected = null;
    card.classList.remove('show');
    if (!hovered) outline.selectedObjects = [];
  }
  document.getElementById('card-close').addEventListener('click', closeCard);

  // ------------------------------------------------------------ camera moves
  const views = {
    home: () => ({ target: HOME_TARGET.clone(), pos: HOME_TARGET.clone().addScaledVector(HOME_DIR, homeDistance()) }),
    desk: () => { const t = new THREE.Vector3(0.45, 1.05, -2.0); return { target: t, pos: t.clone().add(new THREE.Vector3(3.0, 1.2, -0.7)) }; },
    window: () => { const t = new THREE.Vector3(2.5, 1.45, -0.3); return { target: t, pos: t.clone().add(new THREE.Vector3(1.4, 0.7, -3.4)) }; },
    lounge: () => { const t = new THREE.Vector3(3.3, 0.55, -1.3); return { target: t, pos: t.clone().add(new THREE.Vector3(2.8, 2.0, -2.6)) }; },
  };
  function flyTo(name) {
    stopTour();
    const v = views[name]();
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    tween(1300, (e) => {
      camera.position.lerpVectors(p0, v.pos, e);
      controls.target.lerpVectors(t0, v.target, e);
    });
  }

  // Tour: ping-pong between the azimuth limits
  let touring = false;
  const tourBtn = document.getElementById('btn-tour');
  function stopTour() { touring = false; controls.autoRotate = false; tourBtn.classList.remove('active'); }
  tourBtn.addEventListener('click', () => {
    touring = !touring;
    controls.autoRotate = touring;
    tourBtn.classList.toggle('active', touring);
  });
  onFrame(() => {
    if (!touring) return;
    const a = controls.getAzimuthalAngle();
    if (a <= controls.minAzimuthAngle + 0.01) controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed);
    if (a >= controls.maxAzimuthAngle - 0.01) controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed);
  });

  // ------------------------------------------------------------ UI wiring
  document.querySelectorAll('#mode-seg button').forEach((b) =>
    b.addEventListener('click', () => { actions.setNight(b.dataset.mode === 'night'); refreshCard(); }));
  const bind = (id, fn) => document.getElementById(id).addEventListener('change', (e) => { fn(e.target.checked); refreshCard(); });
  bind('sw-led', actions.setLED);
  bind('sw-softbox', actions.setSoftbox);
  bind('sw-logo', actions.setLogo);
  bind('sw-ac', actions.setAC);
  document.querySelectorAll('#rgb-swatches button').forEach((b) =>
    b.addEventListener('click', () => { actions.setRGB(b.dataset.color); refreshCard(); }));
  document.getElementById('btn-reset').addEventListener('click', () => flyTo('home'));
  document.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', () => flyTo(b.dataset.focus)));

  const panel = document.getElementById('panel');
  document.getElementById('panel-toggle').addEventListener('click', () => panel.classList.toggle('collapsed'));
  if (window.innerWidth > 0 && window.innerWidth < 640) panel.classList.add('collapsed');

  const hint = document.getElementById('hint');
  function hideHint() { hint.classList.add('fade'); }
  setTimeout(hideHint, 9000);

  // Shareable start state: ?mode=night
  if (new URLSearchParams(location.search).get('mode') === 'night') actions.setNight(true);

  // Expose for debugging in the console
  window.__room = { state, actions, scene, camera, controls };
}
