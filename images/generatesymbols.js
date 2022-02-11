// Execute with node.js
// Needs to have inkscape installed and accessible in PATH

const { exec } = require("child_process");

function render(row, column, name) {
  exec(`c:/Progra~1/Inkscape/bin/inkscape.com --actions="export-area:${column*300}:${row*165}:${column*300+300}:${row*165+150}" --export-filename "${name}.png" symbols.svg`,
  (error, stdout, stderr) => {
      if (error) {
          console.log(`error: ${error.message}`);
          return;
      }
      if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
      }
      console.log(`stdout: ${stdout}`);
  });
}
render(0, 0, "test");
render(-1, 0, "testg");
