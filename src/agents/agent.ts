import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { CohereEmbeddings } from "@langchain/cohere";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { z } from "zod";
import dotenv from "dotenv";
import { readTxtFile } from "../../utils/read-text-file";
dotenv.config();

const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
    }),
});

export const callAgent = async (client: MongoClient, query: string, thread_id: string) => {
    const dbName = "hr_database";
    const db = client.db(dbName);
    const collection = db.collection("employees");

    const employeeLookupTool = tool(
        async ({ query, n = 10 }) => {
            console.log("Employee lookup tool called");

            const dbConfig = {
                collection: collection,
                indexName: "vector_index",
                textKey: "embedding_text",
                embeddingKey: "embedding",
            };

            const vectorStore = new MongoDBAtlasVectorSearch(
                new CohereEmbeddings({
                    model: "embed-english-v3.0"
                }),
                dbConfig
            );

            const result = await vectorStore.similaritySearchWithScore(query, n);
            return JSON.stringify(result);
        },
        {
            name: "employee_lookup",
            description: "Gathers employee details from the HR database",
            schema: z.object({
                query: z.string().describe("The search query"),
                n: z.number().optional().default(10).describe("Number of results to return"),
            }),
        }
    );

    const tools = [employeeLookupTool];
    const toolNode = new ToolNode<typeof GraphState.State>(tools);

    const model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        temperature: 0
    }).bindTools(tools);

    const callModel = async (state: typeof GraphState.State) => {
        const prompt = ChatPromptTemplate.fromMessages([
            [
                "system",
                await readTxtFile("src/prompts/prompt-2.txt")
            ],
            new MessagesPlaceholder("messages"),
        ]);

        const formattedPrompt = await prompt.formatMessages({
            system_message: "You are helpful HR Chatbot Agent.",
            time: new Date().toISOString(),
            tool_names: tools.map((tool) => tool.name).join(", "),
            messages: state.messages,
        });

        const result = await model.invoke(formattedPrompt);
        return { messages: [result] };
    }

    const shouldContinue = (state: typeof GraphState.State) => {
        const messages = state.messages;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // If the LLM makes a tool call, then we route to the "tools" node
        if (lastMessage.tool_calls?.length) {
            return "tools";
        }
        // Otherwise, we stop (reply to the user)
        return "__end__";
    }

    const workflow = new StateGraph(GraphState)
        .addNode("agent", callModel)
        .addNode("tools", toolNode)
        .addEdge("__start__", "agent")
        .addConditionalEdges("agent", shouldContinue)
        .addEdge("tools", "agent");

    // Adding memory to the agent
    const checkpointer = new MongoDBSaver({ client, dbName });
    const app = workflow.compile({ checkpointer });

    // Running the agent
    const finalState = await app.invoke(
        {
            messages: [new HumanMessage(query)],
        },
        { recursionLimit: 15, configurable: { thread_id: thread_id } }
    );
    console.log(finalState.messages[finalState.messages.length - 1]?.content);
    return finalState.messages[finalState.messages.length - 1]?.content;

}