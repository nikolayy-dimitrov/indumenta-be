import dotenv from 'dotenv';
import express, { Application, json, Request, Response } from 'express';
import cors from 'cors';
import { Dragoneye } from "dragoneye-node";
import { ClassificationPredictImageResponse } from "dragoneye-node/dist/classification";

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3001;

const token = process.env.DRAGONEYE_API_KEY;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(json());
app.use(express.urlencoded({ extended: false }));

// API route to handle the Dragoneye request
app.post('/api/predict', async (req: Request, res: Response) => {
    const { fileUrl, modelName } = req.body;
    const dragoneyeClient = new Dragoneye({
        apiKey: token,
    });

    try {
        // Call the Dragoneye API and type the response
        const response: ClassificationPredictImageResponse = await dragoneyeClient.classification.predict({
            image: {
                url: fileUrl,
            },
            modelName,
        });

        if (!response.predictions || response.predictions.length === 0) {
            // If no predictions, set default values
            return res.json([{
                category: "Shoes",
                vibe: null,
                season: "Seasonless"
            }]);
        }

        const predictions = response.predictions.map(prediction => {
            // Category display name
            const categoryName = prediction.category?.displayName || null;

            // Find the "vibe" trait
            const vibeTrait = prediction.traits.find(trait => trait.name === 'vibe');
            const vibeName = vibeTrait?.taxons[0]?.displayName || null;

            const seasonTrait = prediction.traits.find(trait => trait.name === 'season');
            const seasonName = seasonTrait?.taxons[0].displayName || null
            console.log(prediction);
            return { category: categoryName, vibe: vibeName, season: seasonName };
        });

        res.json(predictions);
    } catch (err) {
        res.status(500);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
