import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let playerQueue = [];
const matchPairs = new Map();

app.post('/connect', async (req, res) => {
	const { username, uuid: existingUuid } = req.body;
	const uuid = existingUuid || uuidv4();

	if (!username) {
		return res.status(400).send({ error: 'Username is required' });
	}

	playerQueue.push({ uuid, username });

	res.send({ status: 'Waiting for match', uuid });
	console.log({ status: 'Waiting for match', uuid });

	tryPairPlayers();
});

function tryPairPlayers() {
	if (playerQueue.length >= 2) {
		const player1 = playerQueue.shift();
		const player2 = playerQueue.shift();

		const matchID = uuidv4();
		const matchPair = {
			player1: { ...player1, choice: null },
			player2: { ...player2, choice: null },
		};

		matchPairs.set(matchID, matchPair);
		console.log(`Match created: ${matchID}`);

		sendStartGameSignal(player1.uuid, player2.uuid, matchID);
	}
}

function sendStartGameSignal(uuid1, uuid2, matchID) {
	console.log(
		`Match found for ${uuid1} and ${uuid2}. Match ID: ${matchID}. Start game.`
	);
}

app.get('/startgame', (req, res) => {
	const { uuid } = req.query;
	console.log(`UUID: ${uuid} polled for match.`);

	const match = [...matchPairs.values()].find(
		(pair) => pair.player1.uuid === uuid || pair.player2.uuid === uuid
	);

	if (match) {
		res.send({ status: 'Match found', matchId: getMatchIdByUUID(uuid) });
	} else {
		res.send({ status: 'No match found' });
	}
});

function getMatchIdByUUID(uuid) {
	for (const [matchID, pair] of matchPairs.entries()) {
		if (pair.player1.uuid === uuid || pair.player2.uuid === uuid) {
			return matchID;
		}
	}
	return null;
}

app.post('/game', async (req, res) => {
	const { uuid, choice, matchID } = req.body;

	if (!matchPairs.has(matchID)) {
		return res.status(400).send({ error: 'Invalid match ID' });
	}

	const match = matchPairs.get(matchID);

	if (match.player1.uuid === uuid) {
		match.player1.choice = choice;
		console.log(`Player 1 choice made -- ${choice}`);
	} else if (match.player2.uuid === uuid) {
		match.player2.choice = choice;
		console.log(`Player 2 choice made -- ${choice}`);
	} else {
		return res.status(400).send({ error: 'Invalid player UUID' });
	}

	if (match.player1.choice && match.player2.choice) {
		const result = evaluateGame(match.player1.choice, match.player2.choice);
		const matchResult = {
			player1: {
				uuid: match.player1.uuid,
				choice: match.player1.choice,
				result: result.player1Result,
			},
			player2: {
				uuid: match.player2.uuid,
				choice: match.player2.choice,
				result: result.player2Result,
			},
		};

		matchPairs.delete(matchID);

		await storeMatchResult(matchID, matchResult);

		console.log(`Results stored for match ID: ${matchID}`);
	}

	res.send({ status: 'Choice recorded' });
});

function evaluateGame(choice1, choice2) {
	if (choice1 === choice2) {
		return { player1Result: 'Draw', player2Result: 'Draw' };
	}

	const outcomes = {
		rock: { beats: 'scissors', losesTo: 'paper' },
		paper: { beats: 'rock', losesTo: 'scissors' },
		scissors: { beats: 'paper', losesTo: 'rock' },
	};

	if (outcomes[choice1].beats === choice2) {
		return { player1Result: 'Win', player2Result: 'Loss' };
	} else {
		return { player1Result: 'Loss', player2Result: 'Win' };
	}
}

async function storeMatchResult(matchID, matchResult) {
	try {
		const response = await fetch(
			'https://YOUR_API_ENDPOINT/storeMatchResult',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ matchID, matchResult }),
			}
		);

		if (!response.ok) {
			throw new Error(
				`Failed to store match result: ${response.statusText}`
			);
		}
	} catch (error) {
		console.error('Error storing match result:', error);
	}
}

app.listen(port, () => {
	console.log(`Multiplayer server running on port ${port}`);
});
