### How to generate?

Renderers in this folder were generated from code in [this commit](https://github.com/software-mansion-labs/react-radon-ide/commit/387096b52ea3b8e757e58af6177f29c8eb496edf). To generate it your self use the fallowing command: 

`yarn build react-native --type RN_OSS_DEV`

### What changed compared to the original version?  

In order for Inspector to work properly we need to pass the source of components usage in the jsx code, to achieve that we modify `react-jsx-dev-runtime.development` to append this information to the element at creation time
and also modify the renderers to pass this information along to the inspector. 

#### Note

The react build system will attach a random hash to react version inside the renderer, but the old arch renderer has a check that throws an error if React version in renderer is mismatched with currently used one, 
as we didn't find an elegant solution to that problem if you generate a renderer with the method described in "how to generate" please change the react version to currently used one in the generated renderer code. 