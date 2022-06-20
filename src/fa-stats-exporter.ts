import { stringify } from "csv-stringify";
import { format, formatISO } from "date-fns";
import { FAID, FurAffinityClient, SubmissionStatistic } from "fa.js"
import * as fs from "fs/promises";
import * as process from "process";

interface ConfigFileFormat {
    username: string;
    cookies: Record<string, string>;
}

type RowType = Omit<SubmissionStatistic, "when"> & { when: string };

async function main() {
    try {
        await fs.stat("config.json");
    } catch (err) {
        console.error("Failed to find config.json");
        return;
    }

    const configFileJson = await fs.readFile("config.json", "utf-8");
    const configFile = JSON.parse(configFileJson) as ConfigFileFormat;
    if (!configFile) {
        console.error("Config file invalid");
        return;
    }
    if (!configFile.username) {
        console.error("Config file invalid, missing username");
        return;
    }
    if (!configFile.cookies) {
        console.error("Config file invalid, missing cookies");
        return;
    }

    const cookies = Object.keys(configFile.cookies).map(k => `${k}=${configFile.cookies[k]}`).join("; ");

    const client = new FurAffinityClient({
        cookies,
        disableRetry: true,
        throwErrors: true,
    });

    console.log("Fetching statistics...");

    let output: RowType[] = [];
    const statsIterator = client.getSubmissionStats(configFile.username);
    for await (const page of statsIterator) {
        for (const stats of page.statistics) {
            output.push({
                ...stats,
                when: format(stats.when, "MM/dd/yyyy HH:mm:ss"),
            });
        }
    }

    const csv = stringify(output, {
        columns: [
            { key: "id", header: "ID" },
            { key: "submission_title", header: "Title" },
            { key: "when", header: "When" },
            { key: "views", header: "Views" },
            { key: "favorites", header: "Favorites" },
            { key: "comments", header: "Comments" },
        ],
        header: true,
    });

    const now = new Date();
    await fs.writeFile(`output_${format(now, "yyyyMMdd_HHmmss")}.csv`, csv);
}

console.log("Starting!");
main().then(() => {
    console.log("Done!");
    process.exit();
}).catch((err) => {
    console.error("Got top level error", err);
    process.exit(1);
});
