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

    for (let i = 0; i < moduleRefs.length; i++) {
        const el = moduleRefs[i];
        const key = el.getAttribute("key");
        const include = el.getAttribute("include");

        if (key) {
            if (!modulesMap[key]) modulesMap[key] = new Set();

            if (include) {
                const elems = include.split(/\s+/);
                elems.forEach(e => modulesMap[key].add(e));
            } else {
                // If include is missing, it technically implies ALL elements of that module.
                // We mark this specially or just leave it empty if we can't resolve it without P5 data.
                // For now, let's look for explicit elementSpecs that might define content for this module.
            }
        }
    }

    // 2. ElementSpecs (Customizations or Full Expansions)
    const elementSpecs = xmlDoc.getElementsByTagName("elementSpec");
    for (let i = 0; i < elementSpecs.length; i++) {
        const el = elementSpecs[i];
        const ident = el.getAttribute("ident");
        const module = el.getAttribute("module") || "uncategorized";

        if (ident) {
            if (!modulesMap[module]) modulesMap[module] = new Set();
            modulesMap[module].add(ident);
        }
    }

    // Convert to array format
    return Object.entries(modulesMap).map(([name, set]) => ({
        name,
        elements: Array.from(set).sort()
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
