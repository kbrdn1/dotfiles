#!/bin/bash

# File renaming script with preview
# Usage: ./rename_files.sh [<path> <pattern> <search> <replacement>]
# Example search pattern: "*Resource*" - will find strings containing "Resource"
# Example replace pattern: "*Controller*" - will replace "Resource" with "Controller"

# Getting arguments interactively if not provided
PROJECT_ROOT="${ZED_WORKTREE_ROOT:-$(pwd)}"

if [ -z "$1" ]; then
  echo "Enter path (relative to project root):"
  read -r SEARCH_PATH
else
  SEARCH_PATH="$1"
fi

if [ -z "$2" ]; then
  echo "Enter file pattern (e.g. \"*Resource.php\"):"
  read -r FILE_PATTERN
else
  FILE_PATTERN="$2"
fi

if [ -z "$3" ]; then
  echo "Enter search pattern (e.g. \"*Resource*\"):"
  read -r SEARCH_PATTERN
else
  SEARCH_PATTERN="$3"
fi

if [ -z "$4" ]; then
  echo "Enter replacement pattern (e.g. \"*Controller*\"):"
  read -r REPLACE_PATTERN
else
  REPLACE_PATTERN="$4"
fi

# Convert wildcard patterns to sed patterns
SED_SEARCH_PATTERN=$(echo "$SEARCH_PATTERN" | sed 's/\*/\\(.*\\)/g' | sed 's/\./\\./g')
SED_REPLACE_PATTERN=$(echo "$REPLACE_PATTERN" | sed 's/\*/\\1/g')

# Display parameters
echo "🔍 Searching in: $SEARCH_PATH"
echo "🔎 File pattern: $FILE_PATTERN"
echo "✏️  Replace: $SEARCH_PATTERN"
echo "💫 With: $REPLACE_PATTERN"
echo -e "\n📋 Renaming preview:"

# Counting and previewing
COUNT=0
INVALID_PATHS=0
while IFS= read -r file; do
  # Get relative path for cleaner display
  rel_path="${file#$PROJECT_ROOT/}"

  # Extract the directory and filename parts
  dir_part=$(dirname "$file")
  file_part=$(basename "$file")

  # Apply the pattern to the filename only
  new_file_part=$(echo "$file_part" | sed "s/$SED_SEARCH_PATTERN/$SED_REPLACE_PATTERN/")

  # Recombine for the new path
  newfile="$dir_part/$new_file_part"
  rel_newpath="${newfile#$PROJECT_ROOT/}"

  if [ "$file" != "$newfile" ]; then
    # Check if the extension is properly preserved - especially for .php files
    if [[ "$file" == *".php" && "$newfile" != *".php" ]]; then
      echo "  ⚠️ ERROR: $rel_path → $rel_newpath (Invalid extension)"
      INVALID_PATHS=$((INVALID_PATHS+1))
    else
      echo "  $rel_path → $rel_newpath"
      COUNT=$((COUNT+1))
    fi
  fi
done < <(find "$PROJECT_ROOT/$SEARCH_PATH" -type f -name "$FILE_PATTERN" 2>/dev/null)

# Check number of files found
if [ $COUNT -eq 0 ] && [ $INVALID_PATHS -eq 0 ]; then
  echo "❌ No files to rename found."
  exit 0
fi

if [ $INVALID_PATHS -gt 0 ]; then
  echo -e "\n⚠️ WARNING: $INVALID_PATHS file(s) would have invalid extensions after renaming."
  echo "Please check your search and replace patterns and try again."
  exit 1
fi

echo -e "\n📊 Total: $COUNT file(s) to rename"
echo -e "\n⚠️  Do you want to continue? (y/n)"
read -r confirm

if [ "$confirm" = "y" ]; then
  echo -e "\n🔄 Renaming in progress..."
  while IFS= read -r file; do
    rel_path="${file#$PROJECT_ROOT/}"

    # Extract the directory and filename parts
    dir_part=$(dirname "$file")
    file_part=$(basename "$file")

    # Apply the pattern to the filename only
    new_file_part=$(echo "$file_part" | sed "s/$SED_SEARCH_PATTERN/$SED_REPLACE_PATTERN/")

    # Recombine for the new path
    newfile="$dir_part/$new_file_part"
    rel_newpath="${newfile#$PROJECT_ROOT/}"

    if [ "$file" != "$newfile" ]; then
      echo "  ✅ $rel_path → $rel_newpath"
      mv "$file" "$newfile"
    fi
  done < <(find "$PROJECT_ROOT/$SEARCH_PATH" -type f -name "$FILE_PATTERN" 2>/dev/null)
  echo -e "\n🎉 Renaming completed successfully!"
else
  echo -e "\n🛑 Operation canceled."
fi