import { CohereEmbeddings } from "@langchain/cohere";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import dotenv from "dotenv";
import { EmployeeSchema } from "./schema";
import type { TEmployee } from "./schema";
import { readTxtFile } from "../utils/read-text-file";
dotenv.config();


const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    temperature: 0.7
});

const parser = StructuredOutputParser.fromZodSchema(z.array(EmployeeSchema));

const generateSyntheticData = async (): Promise<TEmployee[]> => {

    const prompt = (await readTxtFile("src/prompts/prompt-1.txt")).concat(`${parser.getFormatInstructions()}`);

    console.log("Generating synthetic data...");

    const response = await llm.invoke(prompt);

    return parser.parse(response.content as string);
}

const createEmployeeSummary = (employee: TEmployee) => {
    const jobDetails = `${employee.job_details.job_title} in ${employee.job_details.department}`;
    const skills = employee.skills.join(", ");
    const performanceReviews = employee.performance_reviews.map((review) => {
        return `Rated ${review.rating} on ${review.review_date}: ${review.comments}`
    }).join(" ");
    const basicInfo = `${employee.first_name} ${employee.last_name}, born on ${employee.date_of_birth}`;
    const workLocation = `Works at ${employee.work_location.nearest_office}, Remote: ${employee.work_location.is_remote}`;
    const notes = employee.notes;
    const summary = `${basicInfo}. Job: ${jobDetails}. Skills: ${skills}. Reviews: ${performanceReviews}. Location: ${workLocation}. Notes: ${notes}`;

    return summary;
}

const seedDatabase = async () => {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB :)");

        const db = client.db("hr_database");
        const collection = db.collection("employees");

        await collection.deleteMany({});

        const syntheticData = await generateSyntheticData();

        const recordsWithSummaries = await Promise.all(syntheticData.map((record) => {
            return {
                pageContent: createEmployeeSummary(record),
                metadata: { ...record }
            }
        }));

        await MongoDBAtlasVectorSearch.fromDocuments(
            recordsWithSummaries,
            // Cohere's "embed-english-v3.0" model generates embeddings with 1024 dimensions.
            new CohereEmbeddings({
                model: "embed-english-v3.0"
            }),
            {
                collection,
                indexName: "vector_index",
                textKey: "embedding_text",
                embeddingKey: "embedding"
            }
        );

        console.log("successfuly processed & saved records, database seeding complete");

    } catch (error) {
        console.error("Error seeding database :(", error);
    } finally {
        await client.close();
    }
}

seedDatabase().catch(console.error);