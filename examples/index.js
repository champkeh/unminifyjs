let j = require('jscodeshift')

// 需要使用 babylon 解析器
j = j.withParser('babylon')


const source = `
if ("dark" === theme) {}
while (10 < count) {}
`

const root = j(source)

function swipeBinaryExpression(node) {
    let tmp = node.left
    node.left = node.right
    node.right = tmp
}

function handle(root) {
    root.find(j.BinaryExpression, {right: {type: 'Identifier'}})
        .filter(path => j(path.node.left).isOfType(j.Literal))
        .forEach(path => {
            const node = path.node
            const operator = node.operator

            switch (operator) {
                case '==':
                case '!=':
                case '===':
                case '!==':
                    swipeBinaryExpression(node)
                    break
                case '>':
                    swipeBinaryExpression(node)
                    node.operator = '<'
                    break
                case '>=':
                    swipeBinaryExpression(node)
                    node.operator = '<='
                    break
                case '<':
                    swipeBinaryExpression(node)
                    node.operator = '>'
                    break
                case '<=':
                    swipeBinaryExpression(node)
                    node.operator = '>='
                    break
            }
        })
}

handle(root)


console.log(root.toSource())
