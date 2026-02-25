
import { parseODD, addElementToODD } from "./src/utils/oddUtils.js";
import fs from "fs";
import path from "path";

// Mock browser globals for Node environment testing
import { DOMParser, XMLSerializer } from "xmldom";
global.DOMParser = DOMParser;
global.XMLSerializer = XMLSerializer;

const oddPath = path.resolve("./src/tei_acallam.odd");
const oddContent = fs.readFileSync(oddPath, "utf-8");

console.log("Original ODD length:", oddContent.length);

try {
    console.log("Parsing original...");
    const modules = parseODD(oddContent);
    console.log("Modules found:", modules.length);

    console.log("Adding element 'testElement'...");
    const newXml = addElementToODD(oddContent, {
        name: "testElement",
        module: "core",
        description: "A test element",
        attributes: [{ name: "testAttr", type: "string" }]
    });

    console.log("New XML length:", newXml.length);

    console.log("Parsing new XML...");
    const newModules = parseODD(newXml);
    console.log("New modules found:", newModules.length);

    const coreMod = newModules.find(m => m.name === "core");
    if (coreMod && coreMod.elements.includes("testElement")) {
        console.log("SUCCESS: testElement found in core module.");
        console.log("Elements in core:", coreMod.elements.join(", "));
    } else {
        console.error("FAILURE: testElement NOT found in core module.");
        console.log("Core elements:", coreMod ? coreMod.elements : "Module not found");
    }

} catch (err) {
    console.error("CRASHED:", err);
}
