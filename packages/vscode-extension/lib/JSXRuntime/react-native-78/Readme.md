### How to generate?

Jsx runtime in this folder were generated from code on [this branch](https://github.com/software-mansion-labs/react-radon-ide/tree/EnableSourceInspectingRN78). To generate it your self use the fallowing command: 

`yarn build react/jsx-dev-runtime --type node_dev`

### What changed compared to the original version?  

In order for Inspector to work properly we need to pass the source of components usage in the jsx code, to achieve that we modify `react-jsx-dev-runtime.development` to append this information to the element at creation time. 