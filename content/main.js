const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
  const retrieveButton = document.getElementById("retrieve");
  retrieveButton.addEventListener("click", handleRetrieveClick);
}

function handleRetrieveClick() {
  const fqdnValue = document.getElementById("fqdn").value;
  const usernameValue = document.getElementById("username").value;
  const passwordValue = document.getElementById("password").value;
  const savedactionidsValue = document.getElementById("savedactionids").value;

  vscode.postMessage({
    command: "retrieve",
    fqdn: fqdnValue,
    username: usernameValue,
    password: passwordValue,
    savedActionIds: savedactionidsValue,
  });
}