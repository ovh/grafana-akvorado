#!/bin/bash

# Function to increment version number
increment_version() {
    local version=$1
    local IFS='.'
    local -a parts=($version)
    local major=${parts[0]}
    local minor=${parts[1]}
    local patch=${parts[2]}
    patch=$((patch + 1))
    echo "$major.$minor.$patch"
}

# Read current version from the JSON file
current_version=$(jq -r '.version' package.json)

# Increment the version number
new_version=$(increment_version $current_version)

# Update the version in the JSON file
jq --arg new_version "$new_version" '.version = $new_version' package.json > tmp.json && mv tmp.json package.json

# Commit the changes
git add package.json
git commit -m "Bump to v$new_version"

# Create a git tag
git tag "v$new_version"

# Push the commit and tag
git push origin main
git push origin tag "v$new_version"

echo "Version bumped to $new_version and pushed to remote repository."
