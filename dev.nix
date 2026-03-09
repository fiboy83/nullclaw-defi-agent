# Project IDX configuration for NullClaw DeFi Agent
{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.git
    pkgs.curl
    pkgs.jq
  ];

  idx = {
    extensions = [
      "bradlc.vscode-tailwindcss"
      "dbaeumer.vscode-eslint"
      "esbenp.prettier-vscode"
    ];

    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev:ui"];
          manager = "web";
          env = {
            PORT = "$PORT";
          };
        };
      };
    };

    workspace = {
      onCreate = {
        install = "npm install && cd sidecar && npm install && cd ../ui && npm install";
      };
      onStart = {
        dev = "npm run dev";
      };
    };
  };
}
