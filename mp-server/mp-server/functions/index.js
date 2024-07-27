import * as functions from 'firebase-functions';
import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import serviceAccount from './tamagame-57544-b3176c3428fb.json' assert { type: 'json' };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://tamagame-57544.firebaseio.com', // Replace with your Firestore project ID
});

const db = admin.firestore();

const app = express();
// const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let playerQueue = [];
const matchPairs = new Map();
const matchResults = new Map();
const matchQueryCounts = new Map();

app.post('/health', async (req, res) => {
    console.log('/health invoked');
    setTimeout(() => {
        res.send({ status: 'OK' });
        console.log('/health response sent');
    }, 30000);
});

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

    playerQueue.push({ uuid, username });

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
    } catch (error) {
        console.error('Error adding/retrieving player data:', error);
        return res.status(500).send({ error: 'Failed to store player data' });
    }

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
        res.send({ status: 'Match found!', matchId: getMatchIdByUUID(uuid) });
    } else {
        res.send({ status: 'No match found!' });
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
    console.log(`/game invoked with ${JSON.stringify(req.body)}`);
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

        matchResults.set(matchID, matchResult);
        console.log(`Results stored for match ID: ${matchID}`);

        // Asynchronous database write, without blocking game logic
        storeMatchResultInDatabase(matchID, matchResult);

        // Update win/loss/tie statistics in database
        await updatePlayerStatistics(match.player1.uuid, result.player1Result);
        await updatePlayerStatistics(match.player2.uuid, result.player2Result);

        setTimeout(() => {
            matchResults.delete(matchID);
            console.log(`Results deleted for match ID: ${matchID}`);
        }, 60000); // Delete results after 60 seconds

        matchPairs.delete(matchID);
    }

    res.send({ status: 'Choice recorded' });
});

async function storeMatchResultInDatabase(matchID, matchResult) {
    console.log('stored MatchID: ' + matchID);
    console.log('stored MatchResult: ' + JSON.stringify(matchResult));
    const newResult = JSON.stringify(matchResult);

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
    } catch (error) {
        console.error('Error storing match data:', error);
    }
}

app.get('/results', (req, res) => {
    const { matchID, uuid } = req.query;

    if (!matchID || !uuid) {
        return res
            .status(400)
            .send({ error: 'Match ID and UUID are required' });
    }

    if (matchResults.has(matchID)) {
        res.send(matchResults.get(matchID));

        // Track the players querying for results
        if (!matchQueryCounts.has(matchID)) {
            matchQueryCounts.set(matchID, new Set());
        }
        matchQueryCounts.get(matchID).add(uuid);

        // Check if both players have queried the results
        const match = matchResults.get(matchID);
        if (
            matchQueryCounts.get(matchID).has(match.player1.uuid) &&
            matchQueryCounts.get(matchID).has(match.player2.uuid)
        ) {
            storeMatchResultInDatabase(matchID, match);
            matchResults.delete(matchID);
            matchQueryCounts.delete(matchID);
            console.log(
                `Match concluded and results deleted for match ID: ${matchID}`
            );
        }
    } else {
        res.send({ status: 'Match not found' });
    }
});

function evaluateGame(choice1, choice2) {
    console.log(`${choice1} vs ${choice2}`);
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

async function updatePlayerStatistics(uuid, result) {
    const playerRef = db.collection('players').doc(uuid);
    const playerSnapshot = await playerRef.get();

    if (!playerSnapshot.exists) {
        console.error(`Player with UUID ${uuid} not found`);
        return;
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

    try {
        await playerRef.update({ winLossTie: playerData.winLossTie });
        console.log(`Updated player statistics for UUID: ${uuid}`);
    } catch (error) {
        console.error('Error updating player statistics:', error);
    }
}

app.post('/simulate', async (req, res) => {
    console.log('Simulate endpoint invoked');
    const { uuid } = req.body;

    // Trigger the /connect endpoint with the UUID for the current player
    const response1 = await fetch('http://localhost:3000/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'player1', uuid: uuid }),
    });
    const data1 = await response1.json();
    console.log('Player 1 connected');

    // Trigger the /connect endpoint without UUID for the second player
    const response2 = await fetch('http://localhost:3000/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'player2' }),
    });
    const data2 = await response2.json();
    const player2uuid = data2.uuid;
    console.log('Player 2 connected');

    const matchID = getMatchIdByUUID(uuid);

    // Trigger the /game endpoint for both players with their choices and matchID
    await fetch('http://localhost:3000/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuid, choice: 'rock', matchID }),
    });
    console.log('Player 1 made a choice');

    await fetch('http://localhost:3000/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uuid: player2uuid,
            choice: 'scissors',
            matchID,
        }),
    });
    console.log('Player 2 made a choice');

    // Check the results
    const response3 = await fetch(
        `http://localhost:3000/results?matchID=${matchID}&uuid=${uuid}`
    );
    const data3 = await response3.json();

    const response4 = await fetch(
        `http://localhost:3000/results?matchID=${matchID}&uuid=${player2uuid}`
    );
    const data4 = await response4.json();

    console.log('Match results for Player 1:', data3);
    console.log('Match results for Player 2:', data4);

    // Send the results back as the response of the /simulate endpoint
    res.send({ player1: data3, player2: data4 });
});

// app.listen(port, () => {
// 	console.log(`Server running on port ${port}`);
// });

export const api = functions.https.onRequest(app);