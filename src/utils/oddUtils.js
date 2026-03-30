/**
 * Parses the TEI ODD XML content to extract module definitions and all available elements.
 * @param {string} xmlString - The raw XML string of the ODD file.
 * @returns {Array<{name: string, elements: string[]}>} List of modules and their included elements.
 */
export const parseODD = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // 1. ModuleRefs (Standard ODD inclusions)
    const moduleRefs = xmlDoc.getElementsByTagName("moduleRef");
    const modulesMap = {}; // name -> Set(elements)
    const elementDetails = {}; // ident -> { desc }

    for (let i = 0; i < moduleRefs.length; i++) {
        const el = moduleRefs[i];
        const key = el.getAttribute("key");
        const include = el.getAttribute("include");

        if (key) {
            if (!modulesMap[key]) modulesMap[key] = new Set();
            if (include) {
                const elems = include.split(/\s+/);
                elems.forEach(e => modulesMap[key].add(e));
            }
        }
    }

    // 2. ElementSpecs (Customizations or Full Expansions)
    const elementSpecs = xmlDoc.getElementsByTagName("elementSpec");
    for (let i = 0; i < elementSpecs.length; i++) {
        const el = elementSpecs[i];
        const ident = el.getAttribute("ident");
        const module = el.getAttribute("module") || "uncategorized";
        
        const descriptions = {};
        const descEls = el.getElementsByTagName("desc");
        for (let j = 0; j < descEls.length; j++) {
            const lang = descEls[j].getAttribute("xml:lang") || "en";
            descriptions[lang] = descEls[j].textContent.trim();
        }

        // Extract example if present in <egXML>
        let docExample = undefined;
        let egElements = el.getElementsByTagName("egXML");
        if (egElements.length === 0) egElements = el.getElementsByTagNameNS("*", "egXML");
        
        if (egElements.length > 0) {
            try {
                const serializer = new XMLSerializer();
                const children = egElements[0].childNodes;
                let exampleStr = "";
                for (let k = 0; k < children.length; k++) {
                    exampleStr += serializer.serializeToString(children[k]);
                }
                const cleanedStr = exampleStr.trim();
                if (cleanedStr) {
                    docExample = cleanedStr;
                }
            } catch (e) {
                console.warn("Could not serialize egXML for", ident, e);
            }
        }

        if (ident) {
            if (!modulesMap[module]) modulesMap[module] = new Set();
            modulesMap[module].add(ident);
            elementDetails[ident] = { descriptions, docExample };
        }
    }

    // Convert to array format with detailed objects
    return Object.entries(modulesMap).map(([name, set]) => ({
        name,
        elements: Array.from(set).map(ident => ({
            id: ident,
            label: ident,
            descriptions: elementDetails[ident]?.descriptions || {},
            docExample: elementDetails[ident]?.docExample
        })).sort((a, b) => a.id.localeCompare(b.id))
    }));
};

/**
 * Adds a new element specification to the ODD XML.
 * @param {string} xmlString - Current ODD XML.
 * @param {object} elementData - { name, module, description, attributes: [{name, type}] }
 * @returns {string} Updated XML.
 */
export const addElementToODD = (xmlString, { name, module, description, attributes = [] }) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Find where to insert: preferably inside the schemaSpec
    let schemaSpec = xmlDoc.getElementsByTagName("schemaSpec")[0];
    if (!schemaSpec) {
        // Fallback: create schemaSpec if missing (rare for valid ODD)
        const body = xmlDoc.getElementsByTagName("body")[0];
        if (body) {
            schemaSpec = xmlDoc.createElement("schemaSpec");
            schemaSpec.setAttribute("ident", "tei_custom");
            body.appendChild(schemaSpec);
        } else {
            throw new Error("Invalid ODD: No body key found.");
        }
    }

    // Create elementSpec
    const elSpec = xmlDoc.createElement("elementSpec");
    elSpec.setAttribute("ident", name);
    elSpec.setAttribute("module", module);
    elSpec.setAttribute("mode", "add");

    // Add description (desc)
    const descEl = xmlDoc.createElement("desc");
    descEl.textContent = description;
    elSpec.appendChild(descEl);

    // Add classes (model.global usually allows it to appear anywhere)
    const classes = xmlDoc.createElement("classes");
    const memberOf = xmlDoc.createElement("memberOf");
    memberOf.setAttribute("key", "model.global");
    classes.appendChild(memberOf);
    elSpec.appendChild(classes);

    // Add content (empty or text)
    const content = xmlDoc.createElement("content");
    content.appendChild(xmlDoc.createElement("textNode")); // Default to allowing text
    elSpec.appendChild(content);

    // Add attributes
    if (attributes.length > 0) {
        const attList = xmlDoc.createElement("attList");
        attributes.forEach(attr => {
            const attDef = xmlDoc.createElement("attDef");
            attDef.setAttribute("ident", attr.name);
            attDef.setAttribute("mode", "add");

            const attDesc = xmlDoc.createElement("desc");
            attDesc.textContent = "User defined attribute";
            attDef.appendChild(attDesc);

            const datatype = xmlDoc.createElement("datatype");
            const dataRef = xmlDoc.createElement("dataRef");
            dataRef.setAttribute("key", "teidata.word"); // simplified default
            datatype.appendChild(dataRef);
            attDef.appendChild(datatype);

            attList.appendChild(attDef);
        });
        elSpec.appendChild(attList);
    }

    schemaSpec.appendChild(elSpec);

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
};
