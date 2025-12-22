const { ipcRenderer, session } = require('electron');

// Listen for custom events from page scripts to open URLs
document.addEventListener('openCaptchaUrl', (e) => {
  if (e.detail && e.detail.url) {
    ipcRenderer.invoke('open-url', e.detail.url);
  }
});

document.addEventListener('DOMContentLoaded', function () {

  let plugin_interval, bettertelegram_config, tx_interval;
  function show_error(message) {
      const error_box = document.getElementById('errorBox');
      document.getElementById('errorMessage').textContent = message;
      error_box.style.display = 'block';
      error_box.classList.add('show');

      setTimeout(() => {
          error_box.classList.remove('show');
          setTimeout(() => error_box.style.display = 'none', 500);
      }, 5555);
  }

	const modal = document.getElementById('modal');
	const modal_ok = document.getElementById('modal-ok');
	if (modal_ok) modal_ok.addEventListener('click', () => modal.classList.remove('show'));
	function show_modal(message) {
		document.getElementById('modal-message').textContent = message;
		modal.classList.add('show');
	}

  const minimize_button = document.getElementById('minimize-button');
  const maximize_button = document.getElementById('maximize-button');
  const    close_button = document.getElementById(   'close-button');
  if (maximize_button && minimize_button && close_button) {
    minimize_button.addEventListener('click', (e) => ipcRenderer.invoke('minimize_window'));
    maximize_button.addEventListener('click', (e) => ipcRenderer.invoke('maximize_window'));
       close_button.addEventListener('click', (e) => ipcRenderer.invoke(   'close_window'));
  }

  let last_line = 0, appV = '', dllV = '';
  ipcRenderer.on('version-info', (e, info) => {
    sessionStorage.setItem('app_version', info.app_version);
    sessionStorage.setItem('dll_version', info.dll_version);
	// this is done so that we can update the console output log
	if (appV !== info.app_version || dllV !== info.dll_version) {
		appV = info.app_version;
		dllV = info.dll_version;
		last_line = 0;
	}
  });

  ipcRenderer.on('download-progress', (e, progress) => {

	const { percent, loadedMb, totalMb } = progress;
	const progress_bar = document.getElementById('progress_bar');
	const download_info = document.getElementById('download_info');
	const progress_wrapper = document.querySelector('.progress-wrapper');

	if (progress_wrapper.style.display === 'none' || !progress_wrapper.style.display) progress_wrapper.style.display = 'block';
	  
	progress_bar.style.width = percent + '%';
	progress_bar.textContent = percent + '%';
	download_info.textContent = `Downloading Patch DLL: ${loadedMb} / ${totalMb} Mb`;

	if (percent >= 100) setTimeout(() => progress_wrapper.style.display = 'none', 1111);
	
  });
  
  const updateToast = document.getElementById('updateToast');

  	function show_update_toast() {
		updateToast.style.transition =
			'left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
		updateToast.classList.add('show')

		setTimeout(() => {
			hide_update_toast()
		}, 5555);
	}

	function hide_update_toast() {
		updateToast.style.transition = 'left 0.5s ease-in, opacity 0.3s ease'
		updateToast.classList.remove('show')
	}

	const update_button = document.getElementById('updateButton');
	ipcRenderer.on('update-available', (e, update) => {
		show_update_toast();
		localStorage.setItem('update-available', 'true');
	});

  if (updateToast) updateToast.addEventListener('click', hide_update_toast);

  const steps = [
	'Downloading update...',
	'Unpacking update.zip...',
	'Restarting BetterTelegram...',
	'Waiting for Telegram update...',
	'Cleaning up & Finalizing...'
];

function update_progress(count_element, water_element, percent) {
	count_element.innerHTML = percent;
	console.log(percent);
	water_element.style.transform = `translate(0, ${100 - percent}%)`;
}

function wait_for_telegram_update() {
	return new Promise((resolve) => {
		const button = document.getElementById('confirm-update-complete');
		if (!button) return resolve();

		const handler = () => {
			button.removeEventListener('click', handler);
			resolve();
		};

		button.addEventListener('click', handler);
	});
}

const update_container = document.getElementById('updateContainer');
const confirm_update = document.getElementById('confirmUpdate');
const block_loading = document.getElementById('block_loading');
const file_name_element = document.getElementById('fileName');
const count_element = document.getElementById('count');
const water_element = document.getElementById('water');
const video = document.getElementById("demo_video");

  if (update_button) {

if (localStorage.getItem('update-available') === 'true') {
	const app_version_msg = document.getElementById('app-version-message');
	if (app_version_msg) app_version_msg.textContent = 'Your app version is outdated! It is recommended to update it, in order to enjoy the latest features'
	update_button.classList.remove('disabled');
	update_button.disabled = false;
}

update_button.addEventListener('click', async function () {
	if (this.disabled) return;

	update_button.classList.add('disabled');
	update_button.disabled = true;

	update_container.classList.add('show');
	count_element.textContent = '0';

	let percent = 0;
	let current_step = 0;
	file_name_element.textContent = steps[current_step];

	ipcRenderer.on('update-download-progress', (event, progress) => {
		percent = Math.floor(progress * 25);
		update_progress(count_element, water_element, percent);
	});

	ipcRenderer.on('update-unzip-progress', (event, progress) => {
		percent = Math.floor(25 + (progress * 25));
		update_progress(count_element, water_element, percent);
	});

	const file_download = await ipcRenderer.invoke('start-update-download');
	if (!file_download.success) return;

	current_step = 1;
	file_name_element.textContent = steps[current_step];

	const unpack_contents = await ipcRenderer.invoke('start-update-setup');
	if (!unpack_contents.success) return;

	current_step = 2;
	file_name_element.textContent = steps[current_step];
	
	localStorage.setItem('update-available', 'false');

	// enough time to show the step 2 completed text so the user knows whats happening
	setTimeout(() => { ipcRenderer.invoke('logout_app', 'bt-update-gui') }, 2222);
});

} else
if (update_container) {

	ipcRenderer.on('resume-bt-update', async (event, arg) => {

		block_loading.classList.add('show');
		update_container.classList.add('show');
		
		switch (arg) {
			case 'bt-update-stage': {
			
				video.classList.add('show');
				block_loading.classList.remove('show');
				confirm_update.classList.add('show');
				
				file_name_element.textContent = '';

				update_progress(count_element, water_element, 50);

				await wait_for_telegram_update();

				video.classList.remove('show');
				block_loading.classList.add('show');
				confirm_update.classList.remove('show');

				current_step = 4;
				file_name_element.textContent = steps[current_step];

				ipcRenderer.on('main-delete-progress', (event, progress) => {
					percent = Math.floor(50 + (progress * 15));
					update_progress(count_element, water_element, percent);
				});

				ipcRenderer.on('main-copy-progress', (event, progress) => {
					percent = Math.floor(65 + (progress * 25));
					update_progress(count_element, water_element, percent);
				});

				const configure_update = await ipcRenderer.invoke('configure-bt-update');
				if (!configure_update.success) return;

				setTimeout(() => { ipcRenderer.invoke('logout_app', 'bt-main-gui') }, 2222);

			} break;
			case 'bt-main-stage': {

				current_step = 4;
				file_name_element.textContent = steps[current_step];

				update_progress(count_element, water_element, 90);

				ipcRenderer.on('temp-delete-progress', (event, progress) => {
					percent = Math.floor(90 + (progress * 9));
					update_progress(count_element, water_element, percent);
				});

				const cleanup_telegram = await ipcRenderer.invoke('cleanup-bt-update');
				if (!cleanup_telegram.success) return;

				update_progress(count_element, water_element, 100);

				setTimeout(() => {
					update_container.classList.remove('show');
					block_loading.classList.remove('show');
					show_update_toast();
				}, 1111);

			} break;
		}
	});
}
  
  ipcRenderer.on('supported-versions', (e, svs) => {
	setTimeout(() => {
		const json = JSON.parse(svs);
		show_modal(`Unfortunately BetterTelegram doesnt currently support your version of Telegram. The 3 latest supported versions of Telegram are as follows\n\n${json.slice(0, 3).join('\n')}\n\nTo enjoy BetterTelegram, navigate to 'https://github.com/telegramdesktop/tdesktop/releases/tag/v${json[0]}'\n\nDownload the Telegram EXE, and then replace your existing Telegram EXE with the downloaded one & then restart BetterTelegram! Optionally, you can wait up to 24-96 hours & we will make sure to cook up support for the latest version of Telegram by then!\n\nWe'd like to thank you for your understanding!`);
	}, 1111);
  });

  const create_account_btn = document.getElementById('login_btn');
  if (create_account_btn) create_account_btn.addEventListener('click', (e) => ipcRenderer.invoke('open-url', 'https://bettertelegram.com/create_account'));
  	if (!tx_interval) {
		tx_interval = setInterval(async () => {
			if (window.location.href !== 'index.html') {
				const txs_list = await ipcRenderer.invoke('verify_txs', sessionStorage.getItem('licenseKey'));
				if (txs_list) {
					const addresses = Object.keys(txs_list);
					if (addresses.length) {
						addresses.forEach(address => {
							const [coin, cost, days] = txs_list[address];
							if (coin && cost && days) {
								ipcRenderer.invoke('show-tx-confirmation',
								`Your payment of ${cost} ${coin.toUpperCase()} to ${address} 
								has been confirmed. Thank you for your continued support of BetterTelegram,
								${days} ${days>1?'days have':'day has'} been added to your license!`);
							}
						});
					}
				}
			}
		}, 20*1000);
	}

	let prev_config_raw = '', which_plugin = (which) => {
		return which.startsWith('OTR') ? 1 : which.startsWith('GHOST') ? 2 : which.startsWith('PURGE') ? 3 : 0 }
	if (!plugin_interval) plugin_interval = setInterval(async () => {
		const obj = await ipcRenderer.invoke('read-config-file');
		if (obj.plugins && obj.plugins !== 'undefined') {
			const new_config_raw = obj.plugins;
			if (new_config_raw !== prev_config_raw) {
				bettertelegram_config = JSON.parse(new_config_raw);
				sessionStorage.setItem('plugin-otr', bettertelegram_config.plugins.otr);
				sessionStorage.setItem('plugin-ghost', bettertelegram_config.plugins.ghost);
				sessionStorage.setItem('plugin-purge', bettertelegram_config.plugins.purge);
				prev_config_raw = new_config_raw;
			}
		}
		if (obj.console && Array.isArray(obj.console)) {
			const editor_el = document.getElementById('editor');
			if (editor_el) {
				// NOTE: clears the console incase a new DLL version was downloaded, so the verbose output can be updated
				if (!last_line) editor_el.innerHTML = '';
				const new_lines = obj.console.slice(last_line);
				if (editor_el && new_lines.length > 0) {
					new_lines.forEach((line, idx) => {
						var plugin = which_plugin(line), plugin_status = '';
						if (plugin) plugin_status = line.substring(line.indexOf('-') + 1);

						editor_el.innerHTML += 
						`<div class="editorCode_content">
						<span class="editorCode_content-num">${idx + 1}</span>
						<p>${plugin ? '<b style="color: '+(plugin_status==='ENABLED'?'rgb(59,190,73)':'rgb(228, 66, 17)')+'; font-weight: 500;">'+plugin_status+'</b>': '' }
						<span class="indent">> ${plugin == 1 ? 'Secure-OTR: ' : plugin == 2 ? 'Ghost-Mode: ' : plugin == 3 ? 'Protect-Messages: ' : line}</span></p></div>`;
					});
				}
				last_line = obj.console.length;
			}
		}
	}, 333);

	const submitBtn = document.getElementById('submitBtn');
	const folderButton = document.getElementById('folderButton');
	const telegram_path = document.getElementById('licenseKey');
	const admin_hint = document.getElementById('adminHint');
	async function invoke_dialog() {
		const file_path = await ipcRenderer.invoke('dialog:openFile');
		if (file_path != null) {
			telegram_path.title = file_path;
			telegram_path.value = file_path;
			const admin = await ipcRenderer.invoke('check-admin-for-path', file_path);
			if (admin && admin.requiresAdmin && !admin.isAdmin) {
				show_error('Administrator permissions are required for Program Files. Please relaunch BetterTelegram as Administrator.');
				if (admin_hint) admin_hint.style.display = 'inline';
				submitBtn.disabled = true;
			} else {
				if (admin_hint) admin_hint.style.display = 'none';
				submitBtn.disabled = false;
			}
		} else invoke_dialog();
	}

	if (folderButton && submitBtn) {
		submitBtn.disabled = true;
		(async () => {
			const auto_path = await ipcRenderer.invoke('detect_telegram');
			if (auto_path) {
				telegram_path.title = auto_path;
				telegram_path.value = auto_path;
				const admin = await ipcRenderer.invoke('check-admin-for-path', auto_path);
				if (admin && admin.requiresAdmin && !admin.isAdmin) {
					show_error('Administrator permissions are required for Program Files. Please relaunch BetterTelegram as Administrator.');
					if (admin_hint) admin_hint.style.display = 'inline';
					submitBtn.disabled = true;
				} else {
					if (admin_hint) admin_hint.style.display = 'none';
				submitBtn.disabled = false;
				}
			}
		})();
		folderButton.addEventListener('click', async () => await invoke_dialog());
		
		// Listen for captcha verified event from the page script (with affiliate)
		document.addEventListener('captchaVerified', async function () {
			if (telegram_path.value.length) {
				const selectedAffiliate = sessionStorage.getItem('selectedAffiliate') || '';
				const result = await ipcRenderer.invoke('setup_app', telegram_path.value, selectedAffiliate);
				if (!result || !result.success) {
					show_error('Administrator permissions are required for Program Files. Please relaunch BetterTelegram as Administrator.');
				} else {
					window.location.href = 'Home.html';
				}
			}
		});
		
		// Listen for connect without affiliate event from the page script
		document.addEventListener('connectWithoutAffiliate', async function () {
			if (telegram_path.value.length) {
				const result = await ipcRenderer.invoke('setup_app', telegram_path.value, '');
				if (!result || !result.success) {
					show_error('Administrator permissions are required for Program Files. Please relaunch BetterTelegram as Administrator.');
				} else {
					window.location.href = 'Home.html';
				}
			}
		});
	}

	const plugin_toggle_buttons = document.querySelectorAll('input[class^="plugin-toggle-"]');
	if (plugin_toggle_buttons) {
		plugin_toggle_buttons.forEach(input => {
			input.addEventListener('click', async function() {
				if (bettertelegram_config && bettertelegram_config?.plugins) {
					const plugin_class = Array.from(input.classList).find(class_name => class_name.startsWith('plugin-toggle-'));
					if (plugin_class) {
						switch (plugin_class.replace('plugin-toggle-', '')) {
							case 'otr': {
								bettertelegram_config.plugins.otr = bettertelegram_config.plugins.otr == 1 ? 0 : 1;
								sessionStorage.setItem('plugin-otr', bettertelegram_config.plugins.otr);
							} break;
							case 'ghost': {
								bettertelegram_config.plugins.ghost = bettertelegram_config.plugins.ghost == 1 ? 0 : 1;
								sessionStorage.setItem('plugin-ghost', bettertelegram_config.plugins.ghost);
							} break;
							case 'purge': {
								bettertelegram_config.plugins.purge = bettertelegram_config.plugins.purge == 1 ? 0 : 1;
								sessionStorage.setItem('plugin-purge', bettertelegram_config.plugins.purge);
							} break;
						}
						await ipcRenderer.invoke('write-config-file', bettertelegram_config);
					}
				}
			});
		});
	}

	const createAccountBtn = document.getElementById('createAccountBtn');
	if (createAccountBtn) createAccountBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://bettertelegram.com/account') });

	const contactUsBtn = document.querySelector('#createAccountBtn a');
	if (contactUsBtn) contactUsBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://t.me/bettertelegramorg') });

  	const selectable_coins = document.querySelectorAll('.selectable-coin')
	const selected_coin_element = document.getElementById('selectedCoin')
	const confirm_button = document.getElementById('confirmButton')
  	if (selectable_coins && selected_coin_element && confirm_button) {

		document.getElementById('logoutButton').addEventListener('click', (e) => ipcRenderer.invoke('logout_app'));
		document.getElementById('copyButton').addEventListener('click', function () {
			navigator.clipboard.writeText(document.getElementById('license_key_text').innerHTML).then(
				() => show_modal('License key copied to clipboard!'),
				(err) => show_error('Failed to copy')
			);
		});

		let selected_coin = 'UNK';
		selectable_coins.forEach(coin => {
			document.getElementById('selectedCoin').textContent = selected_coin.toUpperCase();
			coin.addEventListener('click', function () {
				selectable_coins.forEach(c => c.classList.remove('selected'));
				this.classList.add('selected');
				selected_coin = this.getAttribute('data-coin');
				selected_coin_element.textContent = selected_coin.toUpperCase();
			});
		});

		const tx_modal = document.getElementById('transactionModal');
		confirm_button.addEventListener('click', async function () {
			if (selected_coin === 'UNK') show_error('Please select a coin!');
			else {
				const coin = document.getElementById('selectedCoin').textContent;
				const days = document.getElementById('dayCounter').value;

				const response = await ipcRenderer.invoke('generate_payment', sessionStorage.getItem('license_key'), coin, days);
				if (response.err == 1) show_error('Failed to create transaction, try again later!');
				else {
					document.getElementById('transactionAddress').innerText = response.details.addr;
					document.getElementById('transactionAmount').innerText = `${response.details.amnt} ${response.details.coin}`;
					tx_modal.classList.add('show');
				}
			}
		});
		document.getElementById('closeTransactionModal').addEventListener('click', () => tx_modal.classList.remove('show'));
	}

	const officialSiteBtn = document.querySelector('#officialSiteBtn a');
	if (officialSiteBtn) officialSiteBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://bettertelegram.com') });

	const joinGroupsBtn = document.getElementById('joinGroupsBtn');
	if (joinGroupsBtn) {
		joinGroupsBtn.addEventListener('click', () => {
			const key = sessionStorage.getItem('license_key') || sessionStorage.getItem('licence_key');
			if (key && key.length) ipcRenderer.invoke('open-url', `https://t.me/bettertelegramautomodbot?start=join${key}`);
			else show_error('License key not available');
		});
	}

	const copyButton = document.getElementById('copyButton');
    if (copyButton) {
        copyButton.addEventListener('click', function () {
            const keyEl = document.getElementById('licence_key_text');
            const text = keyEl ? keyEl.innerText || keyEl.textContent : '';
            if (!text) return show_error('License key not available');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(
                    () => show_modal('License key copied to clipboard!'),
                    () => show_error('Failed to copy')
                );
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try {
                    const ok = document.execCommand('copy');
                    if (ok) show_modal('License key copied to clipboard!');
                    else show_error('Failed to copy');
                } catch (e) { show_error('Failed to copy'); }
                document.body.removeChild(ta);
            }
        });
    }

  const license_key_input = document.getElementById('licenseKey');
  const login_form = document.getElementById('loginForm');
  if (login_form && license_key_input) {
		login_form.addEventListener('submit', async e => {
			e.preventDefault()
			const license_key = license_key_input.value.replace(/\s/g, '')
			if (license_key.length === 16) {
				submitBtn.disabled = true;
				const app_config = await ipcRenderer.invoke('verify_login', license_key);
				submitBtn.disabled = false;
				if (app_config.err) {
					show_error(app_config.msg);
					license_key_input.value = '';
				} else
				if (!app_config.err) {
					sessionStorage.setItem('license_key', license_key);
					sessionStorage.setItem('showLoadingAnimation', 'true');
					sessionStorage.setItem('license_days', app_config.days);
					sessionStorage.setItem('srv_uptime', app_config.uptime);
					window.location.href = app_config.page;
				}
			}
		});

    	license_key_input.addEventListener('input', e => {
			const input = e.target.value.replace(/[^0-9]/g, '');
			const formattedInput = input.replace(/(.{4})/g, '$1 ').trim();
			e.target.value = formattedInput;
			if (e.target.value.length > 19) e.target.value = e.target.value.slice(0, 19);
			submitBtn.disabled = e.target.value.length !== 19;
		});
	}

	const autoLoginToggle = document.getElementById('autoLoginToggle')
	if (autoLoginToggle) {
		autoLoginToggle.addEventListener('change', () => {
			if (autoLoginToggle.checked) {
				localStorage.setItem('autologin', 'ok');
			} else {
				localStorage.setItem('autologin', 'no');
			}
		});

		const autoLogin = localStorage.getItem('autologin') ?? 'no';
		ipcRenderer.on('autologin-fill', (e, license) => {
			localStorage.setItem('update-available', 'false');
			if (license.key) {
				if (autoLogin === 'ok') {
					autoLoginToggle.checked = true;
					document.getElementById('licenseKey').value = license.key.match(/.{1,4}/g).join(' ');
					document.getElementById('submitBtn').disabled = false;
				}
			}
		});
	}

	const nightModeToggle = document.getElementById('nightModeToggle')
	const body = document.body

	const savedTheme = localStorage.getItem('theme')
	console.log(savedTheme);
	if (savedTheme === 'dark') {
		body.classList.add('dark')
		if (nightModeToggle) nightModeToggle.checked = true
	} else {
		body.classList.add('light')
	}

	if (nightModeToggle) {
		nightModeToggle.addEventListener('change', () => {
			if (nightModeToggle.checked) {
				body.classList.remove('light')
				body.classList.add('dark')
				localStorage.setItem('theme', 'dark')
			} else {
				body.classList.remove('dark')
				body.classList.add('light')
				localStorage.setItem('theme', 'light')
			}
		})
	}

	const tabs = document.querySelectorAll('.tab')
	if (tabs.length > 0) {
		const activeTab = sessionStorage.getItem('activeTab') || 'Main'

		tabs.forEach(tab => {
			if (tab.id === activeTab) {
				tab.classList.add('activeLink')
			}

			tab.addEventListener('click', function () {
				tabs.forEach(t => t.classList.remove('activeLink'))
				this.classList.add('activeLink')
				sessionStorage.setItem('activeTab', this.id)
			})
		})
	}
});
