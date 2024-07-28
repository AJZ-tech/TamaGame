import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import serviceAccount from './tamagame-57544-b3176c3428fb.json' assert { type: 'json' };

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: 'https://tamagame-57544.firebaseio.com',
});

const db = admin.firestore();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Firestore Handler
// to send data to the database
async function sendToDB(collection, document, data) {
	try {
		const docRef = db.collection(collection).doc(document);
		await docRef.set(data, { merge: true });
		console.log(`Data sent to ${collection}/${document}`);
	} catch (error) {
		console.error(
			`Error sending data to ${collection}/${document}:`,
			error
		);
		throw error;
	}
}

// Firestore Handler to get data from the database
async function getFromDB(collection, document, ...fields) {
	try {
		// Ensure fields is an array and validate that all elements are strings
		fields = fields.flat(); // Flatten the array in case nested arrays are passed

		for (const field of fields) {
			if (typeof field !== 'string') {
				console.error(`Invalid field type: ${field}. All fields must be strings.`);
				throw new TypeError(`Invalid field type: ${field}. All fields must be strings.`);
			}
		}

		const docRef = db.collection(collection).doc(document);
		const docSnapshot = await docRef.get();
		if (docSnapshot.exists) {
			const data = docSnapshot.data();
			console.log(`Data retrieved from ${collection}/${document}`);

			if (fields.length > 0) {
				let filteredData = {};
				fields.forEach((field) => {
					if (data.hasOwnProperty(field)) {
						filteredData[field] = data[field];
					}
				});
				return filteredData;
			} else {
				return data;
			}
		} else {
			console.log(`No document found at ${collection}/${document}`);
			return null;
		}
	} catch (error) {
		console.error(
			`Error retrieving data from ${collection}/${document}:`,
			error
		);
		throw error;
	}
}

// example: /updatePlayerQueue or /updatePlayerQueue?playerQueue=playerQueue
async function updatePlayerQueue(playerQueue) {
	try {
		await sendToDB('serverState', 'playerQueue', { playerQueue });
	} catch (error) {
		console.error('Error updating player queue:', error);
	}
}

function mapToObject(map) {
	const obj = {};
	for (let [key, value] of map) {
		obj[key] = value;
	}
	return obj;
}

// example: /updateMatchPairs or /updateMatchPairs?matchID=matchID
async function updateMatchPairs(matchPairs) {
	try {
		await sendToDB('serverState', 'matchPairs', {
			matchPairs: mapToObject(matchPairs.entries()),
		});
	} catch (error) {
		console.error('Error updating match pairs:', error);
	}
}

// example: /updateMatchResults or /updateMatchResults?matchID=matchID
async function updateMatchResults(matchResults) {
	try {
		await sendToDB('serverState', 'matchResults', {
			matchResults: mapToObjec(matchResults.entries()),
		});
	} catch (error) {
		console.error('Error updating match results:', error);
	}
}

// example: /updateMatchQueryCounts or /updateMatchQueryCounts?matchID=matchID
async function updateMatchQueryCounts(matchQueryCounts) {
	try {
		await sendToDB('serverState', 'matchQueryCounts', {
			matchQueryCounts: mapToObjec(matchQueryCounts.entries()),
		});
	} catch (error) {
		console.error('Error updating match query counts:', error);
	}
}

async function updateServerState(resource, value) {
	try {
		await sendToDB('serverState', resource, {
			value: mapToObjec(value.entries()),
		});
	} catch (error) {
		console.error('Error updating ', resource, ':', error);
	}
}

// example: /getPlayerQueue or /getPlayerQueue?fields=health,userName,uuid,winLossTie
async function getPlayerQueue() {
	try {
		const data = await getFromDB('serverState', 'playerQueue');
		return data ? data.playerQueue : [];
	} catch (error) {
		console.error('Error getting player queue:', error);
		return [];
	}
}

// example: /getMatchPairs or /getMatchPairs?matchID=matchID
async function getMatchPairs() {
	try {
		const data = await getFromDB('serverState', 'matchPairs');
		if (data) {
			console.log(data)

			if (Array.isArray(data.matchPairs)) {
				return new Map(data.matchPairs);
			}

			console.error('matchPairs is not in the expected array format.');
		}

		return new Map();
	} catch (error) {
		console.error('Error getting match pairs:', error);
		return new Map();
	}
}

// example: /getMatchResults or /getMatchResults?matchID=matchID
async function getMatchResults() {
	try {
		const data = await getFromDB('serverState', 'matchResults');
		return data ? new Map(data.matchResults) : new Map();
	} catch (error) {
		console.error('Error getting match results:', error);
		return new Map();
	}
}

async function getFromServerState(resource) {
	try {
		const data = await getFromDB('serverState', resource);
		return data ? new Map(data[resource]) : new Map();
	} catch (error) {
		console.error('Error getting match results:', error);
		return new Map();
	}
}

async function getFromPlayers(uuid) {
	try {
		const data = await getFromDB('players', uuid);
		return data ? new Map(data[uuid]) : new Map();
	} catch (error) {
		console.error('Error getting match results:', error);
		return new Map();
	}
}

// example: /getMatchQueryCounts or /getMatchQueryCounts?matchID=matchID
async function getMatchQueryCounts() {
	try {
		const data = await getFromDB('serverState', 'matchQueryCounts');
		return data ? new Map(data.matchQueryCounts) : new Map();
	} catch (error) {
		console.error('Error getting match query counts:', error);
		return new Map();
	}
}

// Player Data Management
// example: /getPlayerData?uuid=uuid
async function getPlayerData(uuid) {
	try {
		const playerData = await getFromDB('players', uuid);
		return playerData;
	} catch (error) {
		console.error('Error getting player data:', error);
		return null;
	}
}

async function updatePlayerData(uuid, data) {
	try {
		await sendToDB('players', uuid, data);
	} catch (error) {
		console.error('Error updating player data:', error);
	}
}

// example: /health
app.post('/health', async (req, res) => {
	console.log('/health invoked');
	setTimeout(() => {
		res.send({ status: 'OK' });
		console.log('/health response sent');
	}, 30000);
});

// example: /testDbPush?collection=test&document=test&data=health,userName,uuid,winLossTie
app.get('/testDbPush', (req, res) => {
	console.log('testDbPush successful');
	const data = {
		health: 100,
		userName: 'test',
		uuid: 'test',
		winLossTie: '0/0/0',
		testObj: {
			test: 'test',
			num: 1,
		},
	};

	sendToDB('test', 'test', data);
	res.send({ status: 'OK' });
});

// example: /testDbPull?collection=test&document=test&fields=health,userName,uuid,winLossTie
// if you dont specify fields, it will return all fields
app.get('/testDbPull', async (req, res) => {
	console.log('testDbPull successful');
	const data = await getFromDB('test', 'test', 'winLossTie', 'testObj');
	res.send(data);
});

// example: /getData?collection=players&document=player1&fields=health,userName,uuid,winLossTie
app.get('/getData', async (req, res) => {
	const { collection, document, fields } = req.query;
	let fieldArray = [];

	if (fields) {
		fieldArray = fields.split(','); // Convert comma-separated string to an array
	}

	try {
		const data = await getFromDB(collection, document, fieldArray);
		res.send(data);
	} catch (error) {
		res.status(500).send({ error: 'Error retrieving data' });
	}
});

// example: /sendData?collection=players&document=player1&data={"health": 100, "userName": "test", "uuid": "test", "winLossTie": "0/0/0"}
app.post('/sendData', async (req, res) => {
	const { collection, document, data } = req.body;

	if (!collection || !document || !data) {
		return res
			.status(400)
			.send({ error: 'Collection, document, and data are required' });
	}

	try {
		await sendToDB(collection, document, data);
		res.send({ status: 'Data sent successfully' });
	} catch (error) {
		res.status(500).send({ error: 'Error sending data to the database' });
	}
});

// example: /connect?username=player1 or /connect?username=player1&uuid=uuid
app.post('/connect', async (req, res) => {
	const { username } = req.body;
	let { uuid } = req.body;

	if (!username) {
		return res.status(400).send({ error: 'Username is required' });
	}

	if (!uuid) {
		uuid = uuidv4();
		res.send({ status: 'Waiting for match', uuid });
		console.log({ status: 'Waiting for match with new uuid', uuid });
	} else {
		res.send({ status: 'Waiting for match' });
		console.log({ status: 'Waiting for match with existing uuid', uuid });
	}

	const playerQueue = await getPlayerQueue();
	playerQueue.push({ uuid, username });
	await updatePlayerQueue(playerQueue);

	try {
		const playerSnapshot = await getPlayerData(uuid);

		if (!playerSnapshot) {
			const playerData = {
				health: 100,
				userName: username,
				uuid: uuid,
				winLossTie: '0/0/0',
			};
			await updatePlayerData(uuid, playerData);
			console.log(`New player added to the database with UUID: ${uuid}`);
		} else {
			console.log(`Player already exists with UUID: ${uuid}`);
		}
	} catch (error) {
		console.error('Error adding/retrieving player data:', error);
		return res.status(500).send({ error: 'Failed to store player data' });
	}

	tryPairPlayers();
});

async function tryPairPlayers() {
	const playerQueue = await getPlayerQueue();
	if (playerQueue.length >= 2) {
		const player1 = playerQueue.shift();
		const player2 = playerQueue.shift();
		await updatePlayerQueue(playerQueue);

		const matchID = uuidv4();
		const matchPair = {
			player1: { ...player1, choice: null },
			player2: { ...player2, choice: null },
		};

		const matchPairs = await getMatchPairs();
		matchPairs.set(matchID, matchPair);
		await updateMatchPairs(matchPairs);

		console.log(`Match created: ${matchID}`);

		sendStartGameSignal(player1.uuid, player2.uuid, matchID);
	}
}

function sendStartGameSignal(uuid1, uuid2, matchID) {
	console.log(
		`Match found for ${uuid1} and ${uuid2}. Match ID: ${matchID}. Start game.`
	);
}

// example: /startgame?uuid=uuid or /startgame?uuid=uuid&matchID=matchID
app.get('/startgame', async (req, res) => {
	const { uuid } = req.query;
	console.log(`UUID: ${uuid} polled for match.`);

	const matchPairs = await getMatchPairs();
	const match = [...matchPairs.values()].find(
		(m) => m.player1.uuid === uuid || m.player2.uuid === uuid
	);

	if (match) {
		res.send({ status: 'Match found', matchID: match.matchID });
	} else {
		res.send({ status: 'No match found' });
	}
});

// example: /move?uuid=uuid&matchID=matchID&choice=choice
app.post('/move', async (req, res) => {
	const { uuid, matchID, choice } = req.body;

	if (!uuid || !matchID || !choice) {
		return res
			.status(400)
			.send({ error: 'UUID, matchID, and choice are required' });
	}

	const matchPairs = await getMatchPairs();
	const match = matchPairs.get(matchID);

	if (!match) {
		return res.status(404).send({ error: 'Match not found' });
	}

	const playerKey = match.player1.uuid === uuid ? 'player1' : 'player2';
	match[playerKey].choice = choice;
	matchPairs.set(matchID, match);
	await updateMatchPairs(matchPairs);

	if (match.player1.choice && match.player2.choice) {
		const matchResults = await getMatchResults();
		const matchQueryCounts = await getMatchQueryCounts();

		const result = determineMatchResult(
			match.player1.choice,
			match.player2.choice
		);
		matchResults.set(matchID, result);
		matchQueryCounts.set(matchID, 0);
		await updateMatchResults(matchResults);
		await updateMatchQueryCounts(matchQueryCounts);

		res.send({
			status: 'Move recorded and match result determined',
			result,
		});
	} else {
		res.send({ status: 'Move recorded, waiting for the other player' });
	}
});

function determineMatchResult(choice1, choice2) {
	const validChoices = ['rock', 'paper', 'scissors'];

	if (!validChoices.includes(choice1) || !validChoices.includes(choice2)) {
		throw new Error('Invalid choices');
	}

	if (choice1 === choice2) {
		return 'tie';
	} else if (
		(choice1 === 'rock' && choice2 === 'scissors') ||
		(choice1 === 'scissors' && choice2 === 'paper') ||
		(choice1 === 'paper' && choice2 === 'rock')
	) {
		return 'player1';
	} else {
		return 'player2';
	}
}

// example: /result?matchID=matchID
app.post('/result', async (req, res) => {
	const { matchID } = req.body;

	if (!matchID) {
		return res.status(400).send({ error: 'MatchID is required' });
	}

	const matchQueryCounts = await getMatchQueryCounts();
	const count = matchQueryCounts.get(matchID) || 0;
	matchQueryCounts.set(matchID, count + 1);
	await updateMatchQueryCounts(matchQueryCounts);

	// get the subCollection
	const matchResults = await getMatchResults();
	const result = matchResults.get(matchID);

	if (!result) {
		return res.status(404).send({ error: 'Match result not found' });
	}

	if (count === 0) {
		await updatePlayerStats(matchID, result);
	}

	res.send({ status: 'Match result retrieved', result });
});

async function updatePlayerStats(matchID, result) {
	const matchPairs = await getMatchPairs();
	const match = matchPairs.get(matchID);

	if (!match) {
		throw new Error('Match not found');
	}

	const player1UUID = match.player1.uuid;
	const player2UUID = match.player2.uuid;

	const player1Ref = db.collection('players').doc(player1UUID);
	const player2Ref = db.collection('players').doc(player2UUID);

	const player1Snapshot = await player1Ref.get();
	const player2Snapshot = await player2Ref.get();

	if (!player1Snapshot.exists || !player2Snapshot.exists) {
		throw new Error('Player not found');
	}

	const player1Data = player1Snapshot.data();
	const player2Data = player2Snapshot.data();

	let [player1Wins, player1Losses, player1Ties] = player1Data.winLossTie
		.split('/')
		.map((val) => parseInt(val));
	let [player2Wins, player2Losses, player2Ties] = player2Data.winLossTie
		.split('/')
		.map((val) => parseInt(val));

	if (result === 'player1') {
		player1Wins++;
		player2Losses++;
	} else if (result === 'player2') {
		player2Wins++;
		player1Losses++;
	} else if (result === 'tie') {
		player1Ties++;
		player2Ties++;
	} else {
		throw new Error('Invalid match result');
	}

	const updatedPlayer1Data = {
		...player1Data,
		winLossTie: `${player1Wins}/${player1Losses}/${player1Ties}`,
	};
	const updatedPlayer2Data = {
		...player2Data,
		winLossTie: `${player2Wins}/${player2Losses}/${player2Ties}`,
	};

	await player1Ref.set(updatedPlayer1Data, { merge: true });
	await player2Ref.set(updatedPlayer2Data, { merge: true });

	console.log('Player stats updated successfully');
}

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
