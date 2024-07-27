import express from 'express';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import serviceAccount from './tamagame-57544-b3176c3428fb.json' assert { type: 'json' };

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: 'https://tamagame-57544.firebaseio.com',
});

const db = admin.firestore();

const app = express();
const port = 3002;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/storeMatchResult', async (req, res) => {
	const { matchID, matchResult } = req.body;

	try {
		const matchData = {
			matchID: matchID,
			player1uuid: matchResult.player1.uuid,
			player2uuid: matchResult.player2.uuid,
			player1choice: matchResult.player1.choice,
			player2choice: matchResult.player2.choice,
		};

		await db.collection('matches').doc(matchID).set(matchData);
		console.log(`Match data stored for match ID: ${matchID}`);
		res.send({ status: 'Match data stored' });
	} catch (error) {
		console.error('Error storing match data:', error);
		res.status(500).send({ error: 'Failed to store match data' });
	}
});

app.post('/storePlayer', async (req, res) => {
	const { uuid, username } = req.body;

	try {
		const playerDoc = db.collection('players').doc(uuid);
		const playerSnapshot = await playerDoc.get();

		if (!playerSnapshot.exists) {
			const playerData = {
				health: 100,
				userName: username,
				uuid: uuid,
				winLossTie: '0/0/0',
			};
			await playerDoc.set(playerData);
			console.log(`New player added to the database with UUID: ${uuid}`);
		} else {
			console.log(`Player already exists with UUID: ${uuid}`);
		}
		res.send({ status: 'Player stored' });
	} catch (error) {
		console.error('Error adding/retrieving player data:', error);
		res.status(500).send({ error: 'Failed to store player data' });
	}
});

app.post('/updatePlayerStatistics', async (req, res) => {
	const { uuid, result } = req.body;

	try {
		const playerRef = db.collection('players').doc(uuid);
		const playerSnapshot = await playerRef.get();

		if (!playerSnapshot.exists) {
			console.error(`Player with UUID ${uuid} not found`);
			return res.status(404).send({ error: 'Player not found' });
		}

		const playerData = playerSnapshot.data();
		const [wins, losses, ties] = playerData.winLossTie
			.split('/')
			.map((stat) => parseInt(stat, 10));

		if (result === 'Win') {
			playerData.winLossTie = `${wins + 1}/${losses}/${ties}`;
		} else if (result === 'Loss') {
			playerData.winLossTie = `${wins}/${losses + 1}/${ties}`;
		} else if (result === 'Draw') {
			playerData.winLossTie = `${wins}/${losses}/${ties + 1}`;
		}

		await playerRef.update({ winLossTie: playerData.winLossTie });
		console.log(`Updated player statistics for UUID: ${uuid}`);
		res.send({ status: 'Player statistics updated' });
	} catch (error) {
		console.error('Error updating player statistics:', error);
		res.status(500).send({ error: 'Failed to update player statistics' });
	}
});

app.listen(port, () => {
	console.log(`API server running on port ${port}`);
});
