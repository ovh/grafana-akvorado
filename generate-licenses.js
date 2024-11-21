const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const axios = require('axios');

// Get the list of production dependencies in JSON format
const listedPackagesJson = execSync('npm list -prod -depth 0 --json')
    .toString();

// Parse the JSON to extract the package names and versions
const listedPackages = Object.entries(JSON.parse(listedPackagesJson).dependencies)
    .map(([key, value]) => `${key}@${value.version}`)
    .join(';');

let cmd = `license-checker --json --packages '${listedPackages}' > licenses.json`;
console.log(cmd);

// Run license-checker on the listed packages and output to licenses.json
execSync(cmd, {stdio: 'inherit'});

// Read the licenses.json file
const licensesFilePath = path.join(__dirname, 'licenses.json');
const licensesData = JSON.parse(fs.readFileSync(licensesFilePath, 'utf8'));

// Extract unique licenses and packages
const licensesSet = new Set();
const packages = [];

for (const [packageName, licenseInfo] of Object.entries(licensesData)) {
    const license = licenseInfo.licenses || 'Unknown';
    licensesSet.add(license);
    packages.push({
        name: packageName,
        license,
        licenseFile: licenseInfo.licenseFile,
        repository: licenseInfo.repository
    });
}

// Convert sets to arrays and sort them
const licenses = Array.from(licensesSet).sort();
const sortedPackages = packages.sort((a, b) => a.name.localeCompare(b.name));

// Create directories and copy license files
const outputDir = path.join(__dirname, 'LICENSES');
if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, {force: true, recursive: true});
}
fs.mkdirSync(outputDir, {recursive: true});


sortedPackages.forEach(async ({name, license, licenseFile, repository}) => {
    const packageDir = path.join(outputDir, name);
    if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, {recursive: true});
    }

    if (repository) {
        const repoUrl = new URL(repository);
        const [owner, repo] = repoUrl.pathname.split('/').filter(Boolean);
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/license`;

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            const licenseContent = response.data.content;
            // Add specific headers based on the license type
            let finalContent = Buffer.from(licenseContent, 'base64').toString('utf8');
            const destFilePath = path.join(packageDir, 'LICENSE');
            finalContent = `${name}\n\n${finalContent}`
            fs.writeFileSync(destFilePath, finalContent, 'utf8');
        } catch (error) {
            console.error(`Error fetching license for ${name}:`, error.message);
            // If no LICENSE file is found, write the license text to the file
            fs.writeFileSync(path.join(packageDir, 'LICENSE'), license, 'utf8');
        }
    } else {
        // If no repository is provided, write the license text to the file
        fs.writeFileSync(path.join(packageDir, 'LICENSE'), license, 'utf8');
    }
});

// Generate the output string for the summary file
const outputSummary = `Licences:\n${licenses.join('\n')}\n\nPackages:\n${sortedPackages
    .map(({name, license}) => `${name}; ${license}`)
    .join('\n')}`;

// Write the output summary to a file
const outputSummaryFilePath = path.join(outputDir, 'LICENCES.txt');
fs.writeFileSync(outputSummaryFilePath, outputSummary, 'utf8');

console.log('License information has been written to LICENSES/LICENCES.txt');
