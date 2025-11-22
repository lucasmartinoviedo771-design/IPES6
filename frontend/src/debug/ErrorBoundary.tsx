import React from "react";

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.group("%c[ErrorBoundary] UI crash", "color:#d32f2f;font-weight:bold;");
    console.error(error);

    console.groupEnd();
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, background: "#fee", color: "#900" }}>
          <h3> Se rompió la UI</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}