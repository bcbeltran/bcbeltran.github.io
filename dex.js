// connect to Moralis server
const serverUrl = "https://q41f58ioipk3.usemoralis.com:2053/server";
const appId = "bFk5yVbTBSzh3o4OdytDHFcKq1OxU0cqPXihNAd7";
Moralis.start({ serverUrl, appId });
Moralis.initPlugins().then(() => console.log('Plugins have been initialized...'));

const $tokenBalanceTBody = document.querySelector('.js-token-balances');
const $selectedToken = document.querySelector('.js-from-token');
const $amountInput = document.querySelector(".js-from-amount");

const tokenValue = (value, decimals) => (decimals ? value / Math.pow(10, decimals) : value);

// add from here down for Metamask login and logout
async function login() {
	let user = Moralis.User.current();
	if (!user) {
		user = await Moralis.authenticate();
	}
	console.log("logged in user:", user);
	getStats();
}

async function logOut() {
	await Moralis.User.logOut();
	console.log("logged out");
}

async function initSwapForm(event) {
	event.preventDefault();
	$selectedToken.innerText = event.target.dataset.symbol;
	$selectedToken.dataset.address = event.target.dataset.address;
	$selectedToken.dataset.decimals = event.target.dataset.decimals;
	$selectedToken.dataset.max = event.target.dataset.max;
	$amountInput.removeAttribute('disabled');
	$amountInput.value = '';
	document.querySelector('.js-submit').removeAttribute('disabled');
	document.querySelector('.js-cancel').removeAttribute('disabled');
	document.querySelector('.js-quote-container').innerHTML = '';
	document.querySelector(".js-amount-error").innerText = "";
}

async function getStats() {
	const balances = await Moralis.Web3API.account.getTokenBalances({chain: 'polygon'}); 
	console.log('These are the account balances, ', balances);
	if(balances.length !== 0) {
		$tokenBalanceTBody.innerHTML = balances
			.map(
				(token, index) => `
			<tr>
				<td>${index + 1}</td>
				<td>${token.symbol}</td>
				<td>${tokenValue(token.balance, token.decimals)}</td>
				<td>
					<button
						class="js-swap btn btn-success"
						data-address="${token.token_address}"
						data-symbol="${token.symbol}"
						data-decimals="${token.decimals}"
						data-max="${tokenValue(token.balance, token.decimals)}"
					>
						Swap
					</button>
				</td>
			</tr>
		`
			)
			.join("");

			for (let $btn of $tokenBalanceTBody.querySelectorAll('.js-swap')) {
				$btn.addEventListener('click', initSwapForm);
			}
	} else {
		$tokenBalanceTBody.innerHTML = `
			<tr>
				<td>There are 0 tokens in your wallet</td>
			</tr>
		`
		;
	}
}


async function buyCrypto() {
	Moralis.Plugins.fiat.buy();
}

async function formSubmitted(event) {
	event.preventDefault();
	const fromAmount = $amountInput.value;
	const fromMaxValue = Number.parseFloat($selectedToken.dataset.max);
	if (Number.isNaN(fromAmount) || fromAmount > fromMaxValue) {
		document.querySelector('.js-amount-error').innerText = 'Invalid amount';
		return;
	} else {
		document.querySelector(".js-amount-error").innerText = "";
	}

	const fromDecimals = $selectedToken.dataset.decimals;
	const fromTokenAddress = $selectedToken.dataset.address;

	const [toTokenAddress, toDecimals] = document.querySelector('[name=to-token]').value.split('-');

	try {
		const quote = await Moralis.Plugins.oneInch.quote({
			chain: "polygon", // The blockchain you want to use (eth/bsc/polygon)
			fromTokenAddress, // The token you want to swap
			toTokenAddress, // The token you want to receive
			amount: Moralis.Units.Token(fromAmount, fromDecimals).toString(),
		});
		const toAmount = tokenValue(quote.toTokenAmount,toDecimals);
		document.querySelector(
			".js-quote-container"
		).innerHTML = `
		<p>
		${fromAmount} ${quote.fromToken.symbol} = ${toAmount} ${quote.toToken.symbol}
		</p>
		<p>
			Estimated gas fee: ${quote.estimatedGas}
		</p>
		<button class="btn btn-success">Perform swap</button>
		`;
	} catch (error) {
		document.querySelector('.js-quote-container').innerHTML = `<p class="error">The conversion didn't succeed.</p>`;
	}
}

async function formCancel(event) {
	event.preventDefault();
	document.querySelector('.js-submit').setAttribute('disabled', '');
	document.querySelector('.js-cancel').setAttribute('disabled', '');

	$amountInput.value = '';
	$amountInput.setAttribute('disabled', '');
	
	delete $selectedToken.dataset.address;
	delete $selectedToken.dataset.decimals;
	delete $selectedToken.dataset.max;

	document.querySelector('.js-quote-container').innerHTML = '';
	document.querySelector(".js-amount-error").innerText = "";
}

document.getElementById("btn-login").onclick = login;
document.getElementById('btn-buy-crypto').addEventListener('click', buyCrypto);
document.getElementById("btn-logout").onclick = logOut;

document.querySelector('.js-submit').addEventListener('click', formSubmitted);
document.querySelector('.js-cancel').addEventListener('click', formCancel);


async function getTop10Tokens() {
	try {
		let response = await fetch("https://api.coinpaprika.com/v1/coins");
		let tokens = await response.json();

		return tokens
			.filter((token) => token.rank >= 1 && token.rank <= 30)
			.map((token) => token.symbol);
	} catch (error) {
		console.log(`Error: ${error}`);
	}
}

async function getSupportedTokens(tickerList) {
	const tokens = await Moralis.Plugins.oneInch.getSupportedTokens({
		chain: 'polygon', // The blockchain you want to use (eth/bsc/polygon)
	});
	const tokenList = Object.values(tokens.tokens);

	return tokenList.filter((token) => tickerList.includes(token.symbol));
}

function renderTokenDropdown(tokens) {
	const options = tokens.map(token => `
		<option value="${token.address}-${token.decimals}">
			${token.name}
		</option>
	`).join('');
	document.querySelector('[name=to-token]').innerHTML = options;
}

// function renderForm(tokens) {
// 	const options = tokens.map(
// 		(token) =>
// 			`<option value="${token.decimals}-${token.address}">${token.name} (${token.symbol})</option>`
// 	);

// 	document.querySelector("[name=from-token]").innerHTML = options;

// 	document.querySelector("[name=to-token]").innerHTML = options;

// 	document.querySelector(".js-submit-quote").removeAttribute("disabled");
// }

// async function formSubmitted(event) {
// 	event.preventDefault();
// 	const fromToken = document.querySelector("[name=from-token]").value;
// 	const toToken = document.querySelector("[name=to-token]").value;
// 	const [fromDecimals, fromAddress] = fromToken.split("-");
// 	const [toDecimals, toAddress] = toToken.split("-");
// 	const fromUnit = 10 ** fromDecimals;
// 	const decimalRatio = 10 ** (fromDecimals - toDecimals);

// 	const url = `https://api.1inch.exchange/v3.0/56/quote?fromTokenAddress=${fromAddress}&toTokenAddress=${toAddress}&amount=${fromUnit}`;

// 	try {
// 		const response = await fetch(url);
// 		const quote = await response.json();
// 		const exchange_rate =
// 			(+quote.toTokenAmount / +quote.fromTokenAmount) * decimalRatio;

// 		document.querySelector(".js-quote-container").innerHTML = `
//             <h1>1 ${quote.fromToken.symbol} = ${exchange_rate} ${quote.toToken.symbol}</h1>
//             <h2>Estimated gas fee: ${quote.estimatedGas}</h2>

//         `;
// 	} catch (error) {
// 		document.querySelector(
	// 			".js-quote-container"
	// 		).innerHTML = `<h1>The conversion was not successful. The token you're converting from can't be the token you're converting to.</h1>`;
	// 	}
	// }
	
	// document
	// 	.querySelector(".js-submit-quote")
	// 	.addEventListener("click", formSubmitted);
	
	
	getTop10Tokens().then(getSupportedTokens).then(renderTokenDropdown);
	//.then(renderForm);
	