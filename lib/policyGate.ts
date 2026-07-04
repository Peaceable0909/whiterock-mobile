// Hand-off flag for the sequential policy-acceptance flow at signup:
// register / complete-setup launch the Privacy → Company reader flow, and
// the policy screen sets this when the final "Accept" is pressed.
export const policyGate = { accepted: false }
