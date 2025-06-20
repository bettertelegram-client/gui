// npx electron-packager . inj --icon=C:\Users\vovaj\Desktop\TGOTR\Injector\icon.ico --arch=x64 --out=dist --extra-resource="resources/injector.node" --electron-version=34.0.0 --overwrite
// npx electron-builder --win nsis --x64 --publish never

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const ocr = require('tesseract.js');
const cp = require('child_process');
const { PNG } = require('pngjs');
const winreg = require('winreg');
const crc32 = require('crc-32');
const koffi = require('koffi');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');

// linux - bashrc
// macos - zsh

const log_buffer = [];
function log(message) { log_buffer.push(message); }

let injector;
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  injector = require('@ffxiv-teamcraft/dll-inject');
} else
if (os.platform() === 'win32') {
  injector = require(path.join(__dirname, 'resources', 'injector.node'));
}

let main_window, session_token = '';
var telegram_process_name = '';
var telegram_process_root = '';

koffi.alias('HWND', 'void*');
koffi.alias('HANDLE', 'void*');
koffi.alias('DWORD', 'uint32');
koffi.alias('BOOL', 'int');
koffi.alias('LPSTR', 'char*');

koffi.alias('HDC', 'void*');
koffi.alias('HBITMAP', 'void*');
koffi.alias('HGDIOBJ', 'void*');
koffi.alias('LPRECT', 'void*');
koffi.alias('UINT', 'uint32');
koffi.alias('LONG', 'int32');
koffi.alias('BYTE', 'uint8');

const BI_RGB = 0;
const DIB_RGB_COLORS = 0;

const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long'
});

const gdi32 = koffi.load('gdi32.dll');
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

// thanks to MSDN for the function definitions
const FindWindowExA = user32.func('HWND FindWindowExA(HWND hwndParent, HWND hwndChildAfter, const char* lpszClass, const char* lpszWindow)');
const IsWindowVisible = user32.func('BOOL IsWindowVisible(HWND hWnd)');
const GetWindowTextA = user32.func('int GetWindowTextA(HWND hWnd, LPSTR lpString, int nMaxCount)');
const GetWindowThreadProcessId = user32.func('DWORD GetWindowThreadProcessId(HWND hWnd, DWORD* lpdwProcessId)');
const OpenProcess = kernel32.func('HANDLE OpenProcess(DWORD dwDesiredAccess, BOOL bInheritHandle, DWORD dwProcessId)');
const CloseHandle = kernel32.func('BOOL CloseHandle(HANDLE hObject)');
const GetModuleFileNameExA = kernel32.func('DWORD K32GetModuleFileNameExA(HANDLE hProcess, HANDLE hModule, char* lpFilename, DWORD nSize)');
const GetDC = user32.func('HDC GetDC(HWND hWnd)');
const ReleaseDC = user32.func('int ReleaseDC(HWND hWnd, HDC hDC)');
const GetWindowRect = user32.func('BOOL GetWindowRect(HWND hWnd, RECT* lpRect)');
const PrintWindow = user32.func('BOOL PrintWindow(HWND hwnd, HDC hdcBlt, UINT nFlags)');
const CreateCompatibleDC = gdi32.func('HDC CreateCompatibleDC(HDC hdc)');
const DeleteDC = gdi32.func('BOOL DeleteDC(HDC hdc)');
const CreateCompatibleBitmap = gdi32.func('HBITMAP CreateCompatibleBitmap(HDC hdc, int cx, int cy)');
const SelectObject = gdi32.func('HGDIOBJ SelectObject(HDC hdc, HGDIOBJ h)');
const DeleteObject = gdi32.func('BOOL DeleteObject(HGDIOBJ ho)');
const GetDIBits = gdi32.func('int GetDIBits(HDC hdc, HBITMAP hbmp, UINT uStartScan, UINT cScanLines, void* lpvBits, void* lpbi, UINT uUsage)');

const better_telegram_home = path.join(process.env.APPDATA, 'BetterTelegram');
const better_telegram_plugins = path.join(better_telegram_home, 'cfg', 'plugins.conf');
const better_telegram_app_path = path.join(process.env.LOCALAPPDATA, 'Programs', 'bt', 'bt.exe');
const bt_stub_path = path.join(better_telegram_home, 'stub');

// disable ACL to block telegram updates (since Telegrams IAT hook signatures change, thats what people are paying for on tgupdate so we will do signature updates instead)
function disable_telegram_updates() {
  const telegram_process_path = fs.readFileSync(path.join(better_telegram_home, 'cfg', 'anti_update.dat')).toString().trim();
  telegram_process_name = path.basename(telegram_process_path);
  telegram_process_root = path.dirname (telegram_process_path);
  try {
    if (os.platform() === 'win32') {
      cp.execFileSync('taskkill', ['/IM', telegram_process_name, '/F']);
    } else {
      // note: kill -9 can be used on both linux & macos but by pid instead. so add it after adding linux & macos IAT hooking support
    }
  } catch (err) {}
  const telegram_tupdates_path = path.join(telegram_process_root, 'tupdates');
  try {
    fs.accessSync(telegram_tupdates_path, fs.constants.R_OK | fs.constants.W_OK);
    fs.rmdirSync(telegram_tupdates_path);
    fs.mkdirSync(telegram_tupdates_path);
  } catch (err) {
    if (err.code === 'ENOENT')
      fs.mkdirSync(telegram_tupdates_path);
  }
  try {
    if (os.platform() === 'win32') cp.execSync(`icacls "${telegram_tupdates_path}" /deny *S-1-1-0:(W)`);
    else
    if (os.platform() === 'linux') cp.execSync(`chmod a-w "${telegram_tupdates_path}"`);
    else
    if (os.platform() === 'darwin'); // note: no automated telegram updates on macos
    const proc = cp.spawn(telegram_process_path, {
      detached: true,
      stdio: 'ignore'
    });
    proc.unref();
  } catch (err) {}
}

function set_app_startup() {
  cp.exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v BetterTelegram /t REG_SZ /d "${better_telegram_app_path}" /f`, (err) => {
    if (err) dialog.showMessageBox(main_window, {
      type: 'warning',
      buttons: ['OK'],
      title: 'Failure creating autostart runkey',
      message: `Reason: ${JSON.stringify(err)}`,
    });
    fs.writeFileSync(path.join(better_telegram_home, 'rdfs.bin'), session_token);
  });
}

let hwid_fingerprint = null;
function gather_hwid_fingerprint() {
  const fingerprint = {};
  cp.exec('powershell -Command "Get-CimInstance Win32_ComputerSystemProduct | Select-Object -ExpandProperty UUID"', (err, stdout) => {
    if (err) return;
    fingerprint.uuid = stdout.trim();
    cp.exec('powershell -Command "Get-CimInstance Win32_baseboard | Select-Object -ExpandProperty SerialNumber"', (err, stdout) => {
      if (err) return;
      fingerprint.serial = stdout.trim();
      fingerprint.pc = Buffer.from(`${os.userInfo().username}${os.hostname}`).toString('base64');
      cp.exec('powershell -Command "(Get-ItemProperty \\"HKLM:\\\\SOFTWARE\\\\Microsoft\\\\Windows NT\\\\CurrentVersion\\").InstallDate"', (err, stdout) => {
        if (err) return;
        fingerprint.osi = new Date(parseInt(stdout.trim()) * 1000).toISOString();
        cp.exec('powershell -Command "(Get-ItemProperty \\"HKCU:\\Control Panel\\International\\").LocaleName"', (err, stdout) => {
          if (err) return;
          fingerprint.osl = stdout.trim();
          hwid_fingerprint = fingerprint;
        });
      });
    });
  });
}

function get_latest_bt_stub() {
  try {
    const version_regex = /^bt_v(\d+\.\d+\.\d+)\.(dll|so|dylib)$/;

    const files = fs.readdirSync(bt_stub_path)
      .filter(f => version_regex.test(f))
      .map(f => ({
        full_path: path.join(bt_stub_path, f),
        version: version_regex.exec(f)[1]
      }))
      .sort((a, b) => {
        const verA = a.version.split('.').map(Number);
        const verB = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (verA[i] !== verB[i]) return verA[i] - verB[i];
        }
        return 0;
      });

    const latest = files.pop();

    if (!latest) {
      return {
        file: path.join(bt_stub_path, 'bt_v0.9.9.dll'),
        version: '0.9.9'
      };
    }

    return {
      file: latest.full_path,
      version: latest.version
    };

  } catch (err) {
    return {
      file: path.join(bt_stub_path, 'bt_v0.9.9.dll'),
      version: '0.9.9'
    };
  }
}

function overwrite_config_line(line_number, new_line) {
  log_buffer[line_number] = new_line;
}

var wait_for_download = false;
async function download_bt_update(current_bt_stub = '', app_init = false) {
  if (app_init) log('Initializing BetterTelegram...');
  var platform = os.platform(), dll_version = '', bt_stub = '', tg_version = 'latest', newest_bt_stub = '', version_check = {};
  try { bt_stub = (app_init || !fs.existsSync(current_bt_stub)) ? get_latest_bt_stub() : current_bt_stub; } catch (err) { bt_stub = {file: 'bt_v0.9.9.dll', vers: '0.9.9' }}
  try { if (app_init) cp.execFileSync('taskkill', ['/IM', telegram_process_name, '/F']); // incase the BT DLL is already injected at app startup (else it'll stall)
  } catch (err) { console.log('telegram process not running'); }
  try { const tg_proc_path = fs.readFileSync(path.join(better_telegram_home, 'cfg', 'anti_update.dat')).toString().trim()
  tg_version = cp.execSync(`powershell -Command "($v=(Get-Item \\"${tg_proc_path}\\").VersionInfo.FileVersion).Split('.')[0..2] -join '.'"`).toString().trim();
  } catch (err) { console.log('unable to get telegram version, using latest'); return ''; }
  try {
    version_check = await axios.get(`https://bettertelegram.org/check_version/${os.platform()}/${tg_version}/${bt_stub.version}`, { timeout: 7777 }); 
    if (version_check.data?.latest == false) {
      var bt_stub_info = await axios.get(`https://bettertelegram.org/download_bt_stub/${os.platform()}/${tg_version}/${bt_stub.version}`, { responseType: 'stream', timeout: 7777 });
      newest_bt_stub = `bt_v${bt_stub_info.headers['stub-version']}.${platform==='win32'?'dll':platform==='darwin'?'app':'so'}`;
      if (!current_bt_stub ? true : path.basename(bt_stub.file) !== newest_bt_stub) {
        // if a new version of our BT hook dll exists or this is the app setup phase, we will write it to the BT stub folder
        const writer = fs.createWriteStream(path.join(bt_stub_path, newest_bt_stub));
        const total_file_size = parseInt(bt_stub_info.headers['content-length'], 10);
        setTimeout(async () => {
          var downloaded = 0;
          bt_stub_info.data.on('data', (chunk) => {
            downloaded += chunk.length;
            const percent = Math.round((downloaded / total_file_size) * 100);
            const loadedMb = (downloaded / (1024 * 1024)).toFixed(2);
            const totalMb = (total_file_size / (1024 * 1024)).toFixed(2);
            main_window.webContents.send('download-progress', {
              percent,
              loadedMb,
              totalMb
            });
          });
          // if we inject the latest version of the DLL mid download, unexpected errors will occur or BetterTelegram crashes, so lets wait for it to finish
          wait_for_download = true;
          await new Promise((resolve, reject) => {
            bt_stub_info.data.pipe(writer);
            writer.on('finish', () => {
              wait_for_download = false;
              resolve(1);
            });
            writer.on('error', () => {
              wait_for_download = false;
              resolve(1);
            });
          });
        }, app_init ? 5000 : 500);
        dll_version = bt_stub_info.headers['stub-version'];
      } else
      dll_version = (path.basename(bt_stub.file).match(/v(\d+\.\d+\.\d+)/) || [])[1];
    } else {
      dll_version = (path.basename(bt_stub.file).match(/v(\d+\.\d+\.\d+)/) || [])[1];
      newest_bt_stub = `bt_v${bt_stub.version}.${platform==='win32'?'dll':platform==='darwin'?'app':'so'}`
    }
  } catch (err) {
    dll_version = (path.basename(bt_stub.file).match(/v(\d+\.\d+\.\d+)/) || [])[1];
  }
  const vinfo = {app_version: app.getVersion(), dll_version: dll_version};
  if (app_init) {
    log_buffer.length = 0;
    //if (fs.existsSync(better_telegram_console)) fs.unlinkSync(better_telegram_console);
    log(`Current App Version: ${vinfo.app_version}`);
    log(`Current DLL Version: ${vinfo.dll_version}`);
    log('');
    const plugin_cfg = JSON.parse(fs.readFileSync(better_telegram_plugins).toString().trim());
    log(`OTR-${plugin_cfg.plugins.otr?'ENABLED':'DISABLED'}`);
    log(`GHOST-${plugin_cfg.plugins.ghost?'ENABLED':'DISABLED'}`);
    log(`PURGE-${plugin_cfg.plugins.purge?'ENABLED':'DISABLED'}`);
  } else {
  //if (fs.existsSync(better_telegram_console)) {
    overwrite_config_line(0, `Current App Version: ${vinfo.app_version}`);
    overwrite_config_line(1, `Current DLL Version: ${vinfo.dll_version}`);
  //}
  }
  if (version_check?.data?.svs) {
    // TODO
    // downgrade_tg_to_supported_version.then(() => download_bt_update(current_bt_stub)).catch((err) => {
    //  if (err) {
    //   console.log('Telegram downgrade error: ', err);
        // in this case check if the json response contains 'svs' (supported versions), and if so it means that the current telegram version isnt supported by us
        // then output a modal containing a list of current supported versions (this is mainly for new users, since it will take us 2-4 days to support the latest
        // telegram versions function-pointer signatures ... if a new user installs & is running the latest telegram in this timeframe, they should be notified)
        main_window.webContents.send('supported-versions', JSON.stringify(version_check.data.svs));
     // }
    //}
  }
  main_window.webContents.send('version-info', vinfo);
  return newest_bt_stub;
}

async function wait_until_telegram_loaded() {
  
  let elapsed_time = 0;
  const telegram_window_names = [
    "Qt51515QWindowIcon", // TGv5.14.3+
    "Qt51517QWindowIcon" // TGv5.15+
  ];

  while (elapsed_time < 300000) {
    for (const telegram_window_name of telegram_window_names) {
      let telegram_window = FindWindowExA(null, null, telegram_window_name, null);
      if (telegram_window !== 0n) {
        if (IsWindowVisible(telegram_window)) {
          const window_text = Buffer.alloc(256);
          if (GetWindowTextA(telegram_window, window_text, 256) > 2) {
              const target_pid = Buffer.alloc(4);
              GetWindowThreadProcessId(telegram_window, target_pid);
              const target_process = OpenProcess(0x0400 | 0x0010, 0, target_pid.readUInt32LE(0));
              if (target_process !== 0n) {
                  const target_process_path = Buffer.alloc(256);
                  const target_process_path_len = GetModuleFileNameExA(target_process, null, target_process_path, 256);
                  if (target_process_path_len > 0) {
                      const target_process_name = target_process_path.toString('ascii', 0, target_process_path_len).split(/[\\/]/).pop().toLowerCase();
                      if (target_process_name === 'telegram.exe') {
                          CloseHandle(target_process);
                          return telegram_window;
                      }
                  }
                  CloseHandle(target_process);
              }
          }
        }
      }
      await new Promise(r => setTimeout(r, 111));
      elapsed_time += 111;
    }
  }
  return 0n;
}

async function wait_until_telegram_unlocked(telegram_window) {

  // these functions will never fail since telegram_window will always be valid & if for whatever reason its not, we're meant to crash anyways
  // in that case that will be a bug that I'll need to trace with the specific customer for whom it occurs
  const telegram_device_handle = GetDC(telegram_window);
  const device_context_memory = CreateCompatibleDC(telegram_device_handle);
  let attempts = 0;

  try {
    while (attempts < 300) {
      
      const rect = Buffer.alloc(koffi.sizeof(RECT));
      if (!GetWindowRect(telegram_window, rect)) {
        attempts++;
        continue;
      }

      const left = rect.readInt32LE(0);
      const top = rect.readInt32LE(4);
      const right = rect.readInt32LE(8);
      const bottom = rect.readInt32LE(12);

      const width = right - left;
      const height = bottom - top;

      if (width <= 0 || height <= 0) {
        attempts++;
        continue;
      }
      
      const bitmap_canvas = CreateCompatibleBitmap(telegram_device_handle, width, height);
      if (bitmap_canvas === 0n) {
        attempts++;
        continue;
      }
      
      const bitmap_backup = SelectObject(device_context_memory, bitmap_canvas);
      if (bitmap_backup === 0n) {
        DeleteObject(bitmap_canvas);
        attempts++;
        continue;
      }

      try {
        if (!PrintWindow(telegram_window, device_context_memory, 0)) throw new Error('PrintWindow failed');
        
        // BITMAPINFOHEADER struct
        // reference: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-bitmapinfoheader
        const bmp_info_header = Buffer.alloc(40);
        bmp_info_header.writeInt32LE(40, 0);
        bmp_info_header.writeInt32LE(width, 4);
        bmp_info_header.writeInt32LE(-height, 8);
        bmp_info_header.writeInt16LE(1, 12);
        bmp_info_header.writeInt16LE(32, 14);
        bmp_info_header.writeInt32LE(BI_RGB, 16);
        bmp_info_header.writeInt32LE(0, 20);
        bmp_info_header.writeInt32LE(0, 24);
        bmp_info_header.writeInt32LE(0, 28);
        bmp_info_header.writeInt32LE(0, 32);
        bmp_info_header.writeInt32LE(0, 36);

        const pixel_data = Buffer.alloc(width * height * 4);
        const image_height_pixels = GetDIBits(device_context_memory, bitmap_canvas, 0, height, pixel_data, bmp_info_header, DIB_RGB_COLORS);
        if (image_height_pixels === 0) {
          attempts++;
          continue;
        }
        
        // windows GDI outputs raw pixel data as BGRA, but pngjs expects RGBA so here I am just flipping it
        for (let i = 0; i < pixel_data.length; i += 4) {
          const b = pixel_data[i];
          const g = pixel_data[i + 1];
          const r = pixel_data[i + 2];
          const a = pixel_data[i + 3];

          pixel_data[i] = r;
          pixel_data[i + 1] = g;
          pixel_data[i + 2] = b;
          pixel_data[i + 3] = a;
        }

        // convert the bitmap data to png (as required by Tesseract's OCR engine)
        const png = new PNG({ width, height });
        png.data = pixel_data;

        const chunks = [];
        await new Promise((resolve, reject) => {
          png.pack()
            .on('data', chunk => chunks.push(chunk))
            .on('error', reject)
            .on('end', resolve);
        });

        // parse all the strings inside the context of the telegram image through the OCR
        // NOTE: for now I can only assume that everyone will have telegram UI set to english, if this isnt the case in the future...
        // TODO: add language detection support & control of the 'local'/'passcode' words based on the language codepage
        const result = await ocr.recognize(Buffer.concat(chunks), 'eng');
        const text = result.data.text.toLowerCase();

        // once the 'local' & 'passcode' strings are no longer detected, we know that the user has completed the passcode screen (or it isnt enabled) & we can continue
        if (!text.includes('local') && !text.includes('passcode')) break;

        await new Promise(r => setTimeout(r, 111));
      } finally {
        SelectObject(device_context_memory, bitmap_backup);
        DeleteObject(bitmap_canvas);
      }
    }
  } finally {
    DeleteDC(device_context_memory);
    ReleaseDC(telegram_window, telegram_device_handle);
  }
}

let start_app_main = false;
async function start_injection_thread() {
  var current_bt_stub = await download_bt_update(0, true);
  let injected_pids = [];
  start_app_main = true;
  await dialog.showMessageBox(main_window, {
    type: 'info',
    buttons: ['OK'],
    title: 'BetterTelegram - Information',
    message: 'Due to the software protection we have in our application, after BetterTelegram is injected into your Telegram client it may take 1-3 minutes to load the features. During this time, telegram may freeze (dont close or interact with it). You will be notified within Telegram once the plugins have loaded!'
  });
  async function injection_loop() {
    if (os.platform() === 'win32') {
      const tg_pid = injector.getPIDByName(telegram_process_name);
      if (tg_pid > 0 && !injected_pids.includes(tg_pid) && !wait_for_download) {
        log('');
        log(`Found Telegram with Process ID #${tg_pid}`);
        log('Fetching latest BetterTelegram DLL...');
        current_bt_stub = await download_bt_update(current_bt_stub);
        log('Waiting for Telegram to initialize...');
        const telegram_window = await wait_until_telegram_loaded();
        if (telegram_window !== 0n) {
          log('Waiting for lock-screen exit...');
          await wait_until_telegram_unlocked(telegram_window);
        }
        log('Initialization complete: Injecting...');
        const inject_status = await injector.injectPID(tg_pid, path.join(bt_stub_path, current_bt_stub));
        if (!inject_status) {
          log('Done! Telegram just became Better');
          injected_pids.push(tg_pid);
        } else {
          log('Failed to inject BetterTelegram, please contact support!');
          log(`Error: ${inject_status}`);
          injected_pids.push(tg_pid);
        }
      }
    }
    setTimeout(injection_loop, 1111);
  }
  injection_loop();
}

function main_app_window() {
  main_window = new BrowserWindow({
    width: 465,
    height: 650,
    minWidth: 465,
    minHeight: 650,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'icon.png')
  });
  main_window.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('dialog:openFile', async () => {
  app_part = true;
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [ { name: 'Telegram Executable', extensions: [os.platform() === 'win32' ? 'exe' : os.platform() === 'darwin' ? '.app' : ''] } ]
  });
  app_part = false;
  return result.filePaths;
});

let last_config_data = {};
ipcMain.handle('write-config-file', (e, data) => {
  if (start_app_main) {
    try {
      if (last_config_data.plugins.otr !== data.plugins.otr)
        overwrite_config_line(3,`OTR-${data.plugins.otr ? 'ENABLED' : 'DISABLED'}`);
      else if (last_config_data.plugins.ghost !== data.plugins.ghost)
        overwrite_config_line(4,`GHOST-${data.plugins.ghost ? 'ENABLED' : 'DISABLED'}`);
      else if (last_config_data.plugins.purge !== data.plugins.purge)
        overwrite_config_line(5,`PURGE-${data.plugins.purge ? 'ENABLED' : 'DISABLED'}`);
      last_config_data = data;
      fs.writeFileSync(better_telegram_plugins, JSON.stringify(last_config_data));
    } catch (err) {}
  } else return {};
});

ipcMain.handle('read-config-file', (e) => {
  if (start_app_main) { 
    try {
      const config = {
        plugins: fs.readFileSync(better_telegram_plugins).toString().trim(),
        console: log_buffer };
      if (!Object.keys(last_config_data).length) last_config_data = JSON.parse(config.plugins);
      return config;
    } catch (err) {
      return {};
    }
  } else return {};
});

ipcMain.handle('open-url', (e, url) => shell.openExternal(url));

ipcMain.handle('show-tx-confirmation', async (e, message) => {
  await dialog.showMessageBox(main_window, {
    type: 'info',
    buttons: ['OK'],
    title: 'Transaction Confirmed',
    message: message,
  });
});

let is_maximized = false;
ipcMain.handle('close_window', (e) => app.quit());
ipcMain.handle('minimize_window', (e) => main_window.minimize());
ipcMain.handle('maximize_window', (e) => {
  if (!is_maximized) {
    main_window.maximize();
    is_maximized = true;
  } else {
    main_window.restore();
    is_maximized = false;
  }
});

ipcMain.handle('generate_payment', async (e, licence, coin, days) => {
  try {
    const response = await axios.get(`https://bettertelegram.org/generate_payment/${licence}/${coin}/${days}`);
    return response.data;
  } catch (error) { return { error: 'Failed to fetch data' } }
});

ipcMain.handle('verify_txs', async (e, licence) => {
  try {
    const response = await axios.get(`https://bettertelegram.org/check_transactions/${licence}`);
    return response.data;
  } catch (error) { return {}; }
});

ipcMain.handle('setup_app', (e, telegram_home) => {
  if (!fs.existsSync(better_telegram_home)) {
    fs.mkdirSync(better_telegram_home);
    fs.mkdirSync(path.join(better_telegram_home, 'stub'));
    fs.mkdirSync(path.join(better_telegram_home, 'keys'));
    fs.mkdirSync(path.join(better_telegram_home, 'cfg'));
    fs.writeFileSync(path.join(better_telegram_home, 'cfg', 'anti_update.dat'), telegram_home);
    fs.writeFileSync(better_telegram_plugins, JSON.stringify({"plugins":{"otr": 0, "ghost": 0, "purge": 0}}));
    set_app_startup();
  }
  disable_telegram_updates();
  start_injection_thread();
});

function wait_for_hwid() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (hwid_fingerprint && Object.keys(hwid_fingerprint).length > 0) {
        clearInterval(interval);
        resolve(hwid_fingerprint);
      }
    }, 333);
  });
}

const reg_key = new winreg({ hive: winreg.HKCU, key: '\\Software\\BetterTelegram' });
const create_key_async = (...args) =>
  new Promise((resolve, reject) => {
    reg_key.create(...args, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const set_value_async = (...args) =>
  new Promise((resolve, reject) => {
    reg_key.set(...args, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

function randomize(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle_array(array, seed) {
  let a = [...array];
  let rand = randomize(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stringify(json_obj, licence) {
  try {
    const sorted_obj = {};
    for (const key of shuffle_array(Object.keys(json_obj), crc32.str(licence) >>> 0)) sorted_obj[key] = json_obj[key];
    return JSON.stringify(sorted_obj);
  } catch (err) {
    return 0;
  }
}

function create_crc32_from_hwid(hwid_json, user_licence) {
  const json_obj = stringify(hwid_json, user_licence);
  return json_obj ? (crc32.str(json_obj) >>> 0).toString(16).toUpperCase().padStart(8, '0') : 0;
}

ipcMain.handle('verify_login', async (e, licence) => {
  let app_config = { page: 'index.html', err: 1, msg: '', licence_days: 0, server_uptime: 0, token: '' };
  try {
    const hwid = await wait_for_hwid();
    const au_exists = fs.existsSync(path.join(better_telegram_home, 'cfg', 'anti_update.dat'));
    const response = await axios.post(`https://bettertelegram.org/login/${licence}`, create_crc32_from_hwid(hwid, licence), { headers: { 'Content-Type': 'text/plain' }});
    if (response.data.err === 0) {
      if (!au_exists) { 
        app_config.page = 'LoginTwoSetup.html';
      } else {
        disable_telegram_updates();
        start_injection_thread();
        app_config.page = 'Home.html';
        fs.writeFileSync(path.join(better_telegram_home, 'rdfs.bin'), response.data.token);
      }
      await create_key_async();
      await set_value_async('licence', winreg.REG_SZ, licence);
      session_token = response.data.token;
      app_config.uptime = response.data.uptime;
      app_config.days = response.data.days;
      app_config.err = 0;
    } else {
      app_config.msg = response.data.msg;
    }
  } catch (err) {}
  return app_config;
});

gather_hwid_fingerprint();
ipcMain.handle('logout_app', () => app.quit());
app.whenReady().then(() => main_app_window());
