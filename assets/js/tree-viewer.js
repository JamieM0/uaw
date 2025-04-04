// This file handles the display and interaction of the automation trees, allowing users to explore different paths and workflows.

document.addEventListener('DOMContentLoaded', function() {
    const treeContainer = document.getElementById('tree-container');
    const treeData = {}; // This will hold the automation tree data

    function fetchTreeData() {
        // Fetch the automation tree data from a JSON file or API
        fetch('path/to/your/tree-data.json')
            .then(response => response.json())
            .then(data => {
                treeData = data;
                renderTree(treeData);
            })
            .catch(error => console.error('Error fetching tree data:', error));
    }

    function renderTree(data, parentElement = treeContainer) {
        const ul = document.createElement('ul');

        data.forEach(node => {
            const li = document.createElement('li');
            li.textContent = node.outputText; // Display the step description

            if (node.children && node.children.length > 0) {
                renderTree(node.children, li); // Recursively render child nodes
            }

            ul.appendChild(li);
        });

        parentElement.appendChild(ul);
    }

    function init() {
        fetchTreeData();
    }

    init();
});