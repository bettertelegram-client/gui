const { ipcRenderer } = require('electron');

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

  ipcRenderer.on('supported-versions', (e, svs) => {
	setTimeout(() => {
		const json = JSON.parse(svs);
		show_modal(`Unfortunately BetterTelegram doesnt currently support your version of Telegram. The latest supported versions of Telegram are as follows\n\n${json.slice(0, 10).join('\n')}\n\nTo enjoy BetterTelegram, navigate to 'https://github.com/telegramdesktop/tdesktop/releases/tag/v${json[0]}'\n\nDownload the Telegram EXE, and then replace your existing Telegram EXE with the downloaded one & then restart BetterTelegram! Optionally, you can wait up to 24-96 hours & we will make sure to cook up support for the latest version of Telegram by then!\n\nWe'd like to thank you for your understanding!`);
	}, 1111);
  });

  const create_account_btn = document.getElementById('login_btn');
  if (create_account_btn) create_account_btn.addEventListener('click', (e) => ipcRenderer.invoke('open-url', 'https://bettertelegram.org/create_account'));

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
								${days} ${days>1?'days have':'day has'} been added to your licence!`);
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
	if (folderButton && submitBtn) {
		folderButton.addEventListener('click', async function () {
			const file_path = await ipcRenderer.invoke('dialog:openFile');
			if (file_path && file_path.length > 0) {
				telegram_path.title = telegram_path.placeholder = file_path[0];
				submitBtn.disabled = false;
			}
		});

		submitBtn.addEventListener('click', async function () {
			if (!submitBtn.disabled) await ipcRenderer.invoke('setup_app', telegram_path.placeholder);
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
	if (createAccountBtn) createAccountBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://bettertelegram.org/account') });

	const contactUsBtn = document.querySelector('#createAccountBtn a');
	if (contactUsBtn) contactUsBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://t.me/BetterTelegram_Support') });

  	const selectable_coins = document.querySelectorAll('.selectable-coin')
	const selected_coin_element = document.getElementById('selectedCoin')
	const confirm_button = document.getElementById('confirmButton')
  	if (selectable_coins && selected_coin_element && confirm_button) {

		document.getElementById('logoutButton').addEventListener('click', (e) => ipcRenderer.invoke('logout_app'));
		document.getElementById('copyButton').addEventListener('click', function () {
			navigator.clipboard.writeText(document.getElementById('licence_key_text').innerHTML).then(
				() => show_modal('Licence key copied to clipboard!'),
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

				const response = await ipcRenderer.invoke('generate_payment', sessionStorage.getItem('licence_key'), coin, days);
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
	if (officialSiteBtn) officialSiteBtn.addEventListener('click', (e) => { ipcRenderer.invoke('open-url', 'https://bettertelegram.org') });

  const licence_key_input = document.getElementById('licenseKey');
  const login_form = document.getElementById('loginForm');
  if (login_form && licence_key_input) {
		login_form.addEventListener('submit', async e => {
			e.preventDefault()
			const licence_key = licence_key_input.value.replace(/\s/g, '')
			if (licence_key.length === 16) {
				submitBtn.disabled = true;
				const app_config = await ipcRenderer.invoke('verify_login', licence_key);
				submitBtn.disabled = false;
				if (app_config.err) {
					show_error(app_config.msg);
					licence_key_input.value = '';
				} else
				if (!app_config.err) {
					sessionStorage.setItem('licence_key', licence_key);
					sessionStorage.setItem('showLoadingAnimation', 'true');
					sessionStorage.setItem('licence_days', app_config.days);
					sessionStorage.setItem('srv_uptime', app_config.uptime);
					window.location.href = app_config.page;
				}
			}
		});

    	licence_key_input.addEventListener('input', e => {
			const input = e.target.value.replace(/[^0-9]/g, '');
			const formattedInput = input.replace(/(.{4})/g, '$1 ').trim();
			e.target.value = formattedInput;
			if (e.target.value.length > 19) e.target.value = e.target.value.slice(0, 19);
			submitBtn.disabled = e.target.value.length !== 19;
		});
	}

	const nightModeToggle = document.getElementById('nightModeToggle')
	const body = document.body

	const savedTheme = sessionStorage.getItem('theme')
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
				sessionStorage.setItem('theme', 'dark')
			} else {
				body.classList.remove('dark')
				body.classList.add('light')
				sessionStorage.setItem('theme', 'light')
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
