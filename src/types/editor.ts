export type Language = 'javascript' | 'python' | 'cpp' | 'java';

export type ViewMode = 'code' | 'whiteboard' | 'split';

export type RunStatus = 'idle' | 'running' | 'success' | 'error';

export interface Room {
  id: string;
  code: string;
  language: Language;
  isOwner: boolean;
}

export interface OutputLine {
  type: 'log' | 'error' | 'info' | 'warn';
  content: string;
  timestamp: Date;
}

export const LANGUAGE_CONFIG: Record<Language, {
  label: string;
  extension: string;
  defaultCode: string;
}> = {
  javascript: {
    label: 'JavaScript',
    extension: 'js',
    defaultCode: `// Welcome to CollabCode!
// Write your JavaScript code here

function greet(name) {
  return \`Hello, \${name}! Welcome to CollabCode.\`;
}

console.log(greet("Developer"));

// Try modifying this code and click Run!
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);
`,
  },
  python: {
    label: 'Python',
    extension: 'py',
    defaultCode: `# Welcome to CollabCode!
# Write your Python code here

def greet(name):
    return f"Hello, {name}! Welcome to CollabCode."

print(greet("Developer"))

# Try modifying this code and click Run!
numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]
print("Doubled:", doubled)
`,
  },
  cpp: {
    label: 'C++',
    extension: 'cpp',
    defaultCode: `// Welcome to CollabCode!
// Write your C++ code here

#include <iostream>
#include <vector>
#include <string>

using namespace std;

string greet(const string& name) {
    return "Hello, " + name + "! Welcome to CollabCode.";
}

int main() {
    cout << greet("Developer") << endl;
    
    vector<int> numbers = {1, 2, 3, 4, 5};
    cout << "Doubled: ";
    for (int n : numbers) {
        cout << n * 2 << " ";
    }
    cout << endl;
    
    return 0;
}
`,
  },
  java: {
    label: 'Java',
    extension: 'java',
    defaultCode: `// Welcome to CollabCode!
// Write your Java code here

import java.util.*;

public class Main {
    public static String greet(String name) {
        return "Hello, " + name + "! Welcome to CollabCode.";
    }
    
    public static void main(String[] args) {
        System.out.println(greet("Developer"));
        
        int[] numbers = {1, 2, 3, 4, 5};
        System.out.print("Doubled: ");
        for (int n : numbers) {
            System.out.print(n * 2 + " ");
        }
        System.out.println();
    }
}
`,
  },
};
