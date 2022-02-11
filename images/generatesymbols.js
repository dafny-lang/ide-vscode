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
render(0, 0, "symbol-error");
render(0, 1, "symbol-error-faded");
render(0, 2, "symbol-error-pending");
render(1, 0, "symbol-success");
render(1, 1, "symbol-success-faded");
render(1, 2, "symbol-success-pending");
render(2, 0, "symbol-pending");
render(2, 1, "symbol-pending-faded");
