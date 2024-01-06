let j = require('jscodeshift')

// 需要使用 babylon 解析器
j = j.withParser('babylon')


const source = `
a ? b() : c ? d() : e() ? f() : g()
let xx = a ? b() : c ? d() : e() ? f() : g()
`

const root = j(source)


function collectConditionals(node, conditionals = []) {
    conditionals.push(node)
    if (node.alternate.type === 'ConditionalExpression') {
        collectConditionals(node.alternate, conditionals)
    }
    return conditionals
}

function handle(root) {
    root.find(j.ConditionalExpression)
        .filter(path => path.name === 'expression' && path.node.alternate.type === 'ConditionalExpression')
        .forEach(path => {
            const node = path.node
            const stack = []
            collectConditionals(node, stack)

            while (stack.length) {
                const conditionalNode = stack.pop()

                const ifStatement = j.ifStatement(
                    conditionalNode.test,
                    j.expressionStatement(conditionalNode.consequent),
                    conditionalNode.alternate.type !== 'IfStatement' ? j.expressionStatement(conditionalNode.alternate) : conditionalNode.alternate,
                )

                if (stack.length > 0) {
                    stack[stack.length - 1].alternate = ifStatement
                }
            }
        })
        .replaceWith(path => {
            const node = path.node
            return j.ifStatement(
                node.test,
                j.expressionStatement(node.consequent),
                node.alternate,
            )
        })

    root.find(j.VariableDeclaration)
        .filter(path => path.node.declarations.length === 1 && path.node.declarations[0].init && path.node.declarations[0].init.type === 'ConditionalExpression')
        .forEach(path => {
            const variableDeclarator = path.node.declarations[0]
            const kind = path.node.kind

            j(path).insertBefore(j.variableDeclaration(kind, [
                j.variableDeclarator(variableDeclarator.id, null)
            ]))

            j(path).replaceWith(j.expressionStatement(path.node.declarations[0].init))
            j(path)
                .find(j.ConditionalExpression)
                .filter(path => path.name === 'expression' && path.node.alternate.type === 'ConditionalExpression')
                .forEach(path => {
                    const node = path.node
                    const stack = []
                    collectConditionals(node, stack)

                    const identifier = variableDeclarator.id

                    while (stack.length) {
                        const conditionalNode = stack.pop()

                        const ifStatement = j.ifStatement(
                            conditionalNode.test,
                            j.expressionStatement(j.assignmentExpression('=', identifier, conditionalNode.consequent)),
                            conditionalNode.alternate.type === 'IfStatement' ? conditionalNode.alternate : j.expressionStatement(j.assignmentExpression('=', identifier, conditionalNode.alternate)),
                        )

                        if (stack.length > 0) {
                            stack[stack.length - 1].alternate = ifStatement
                        }
                    }
                })
                .replaceWith(path => {
                    const node = path.node
                    const identifier = variableDeclarator.id

                    return j.ifStatement(
                        node.test,
                        j.expressionStatement(j.assignmentExpression('=', identifier, node.consequent)),
                        node.alternate,
                    )
                })
        })
        .replaceWith(path => path.node)
}

handle(root)


console.log(root.toSource())
