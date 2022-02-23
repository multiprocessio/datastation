module.exports.throwOnErrorBoundary = function (component) {
  component.find('ErrorBoundary').forEach((e) => {
    if (e.find({ type: 'fatal' }).length) {
      // Weird ways to find the actual error message
      throw new Error(e.find('Highlight').props().children);
    }
  });
}
