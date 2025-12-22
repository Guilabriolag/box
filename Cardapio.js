const sabores = [
    { nome: "4 Queijos", ingredientes: "Mussarela, parmesão, provolone e gorgonzola", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Calabresa", ingredientes: "Calabresa fatiada, cebola e azeitonas", inteira: 38, broto: 29, categoria: "pizza" },
    { nome: "Frango Catupiry", ingredientes: "Frango desfiado com Catupiry original", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Portuguesa", ingredientes: "Presunto, ovos, ervilha e mussarela", inteira: 50, broto: 40, categoria: "pizza" },
    { nome: "Baiana", ingredientes: "Calabresa moída, ovos, pimenta e cebola", inteira: 45, broto: 35, categoria: "pizza" },
    { nome: "Escarola", ingredientes: "Escarola refogada com bacon e mussarela", inteira: 46, broto: 36, categoria: "pizza" },
    { nome: "Banana", ingredientes: "Banana fatiada, açúcar e canela", inteira: 41, broto: 31, categoria: "doce" },
    { nome: "Brigadeiro", ingredientes: "Chocolate ao leite e granulado", inteira: 45, broto: 35, categoria: "doce" },
    { nome: "Coca-Cola 2L", preco: 18, categoria: "bebidas" },
    { nome: "Coca-Cola Zero 2L", preco: 18, categoria: "bebidas" },
    { nome: "Heineken", preco: 10, categoria: "bebidas" }
];

let categoriaAtual = 'pizza';
let modoMeia = false;
let selecionadosMeia = [];
let totalItens = 0;

function selecionar(cat) {
    categoriaAtual = cat;
    document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + cat).classList.add('active');
    
    document.getElementById('subnav').style.display = (cat === 'pizza' || cat === 'broto') ? 'flex' : 'none';
    mostrar('inteira');
}

function mostrar(tipo) {
    modoMeia = (tipo === 'meia');
    document.getElementById('btn-inteira').classList.toggle('active', tipo === 'inteira');
    document.getElementById('btn-meia').classList.toggle('active', tipo === 'meia');
    
    const container = document.getElementById('sabores');
    container.innerHTML = '';
    
    const filtrados = sabores.filter(s => {
        if (categoriaAtual === 'calzone') return s.categoria === 'pizza';
        if (categoriaAtual === 'bebidas') return s.categoria === 'bebidas';
        return s.categoria === 'pizza' || s.categoria === 'doce';
    });

    filtrados.forEach(s => {
        let preco = (categoriaAtual === 'pizza') ? s.inteira : s.broto;
        if (categoriaAtual === 'calzone') preco = s.broto;
        if (categoriaAtual === 'bebidas') preco = s.preco;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <h3>${s.nome}</h3>
            <p>${s.ingredientes || ''}</p>
            <div class="price-row">
                <span style="font-size: 1.4rem; font-weight: 900;">R$ ${preco.toFixed(2)}</span>
                <button class="btn-add" onclick="adicionar('${s.nome}', ${preco})">ADD +</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function adicionar(nome, preco) {
    const cart = document.getElementById('pedido');
    if (modoMeia && (categoriaAtual === 'pizza' || categoriaAtual === 'broto')) {
        selecionadosMeia.push({nome, preco});
        showCustomAlert("METADE 1/2", "Selecione o segundo sabor.");
        if (selecionadosMeia.length === 2) {
            const pFinal = Math.max(selecionadosMeia[0].preco, selecionadosMeia[1].preco);
            cart.value += `1/2 ${selecionadosMeia[0].nome} + 1/2 ${selecionadosMeia[1].nome} - R$ ${pFinal.toFixed(2)}\n`;
            selecionadosMeia = [];
            totalItens++;
            document.getElementById('cart-count').innerText = totalItens;
        }
    } else {
        cart.value += `${categoriaAtual.toUpperCase()}: ${nome} - R$ ${preco.toFixed(2)}\n`;
        totalItens++;
        document.getElementById('cart-count').innerText = totalItens;
        showCustomAlert("ADICIONADO", nome + " no carrinho!");
    }
}

function toggleCarrinho() { document.getElementById('carrinho').classList.toggle('open'); }

function mostrarDados(tipo) {
    document.getElementById('pedidoDetalhes').style.display = 'block';
    document.getElementById('entregaCampos').style.display = (tipo === 'delivery') ? 'block' : 'none';
    document.getElementById('btn-retirar').classList.toggle('active', tipo === 'retirar');
    document.getElementById('btn-delivery').classList.toggle('active', tipo === 'delivery');
}

function mostrarTroco() {
    const p = document.getElementById('pagamento').value;
    document.getElementById('trocoArea').style.display = (p === 'Dinheiro') ? 'block' : 'none';
}

function enviarPedido() {
    const itens = document.getElementById('pedido').value;
    const pag = document.getElementById('pagamento').value;
    if (!itens || !pag) return showCustomAlert("OPS", "Complete o pedido!");
    const msg = encodeURIComponent(`*PEDIDO VETORELLI*\n\n${itens}\nPagamento: ${pag}`);
    window.open(`https://wa.me/5511993407322?text=${msg}`);
}

function showCustomAlert(t, m) {
    document.getElementById('custom-alert-title').innerText = t;
    document.getElementById('custom-alert-message').innerText = m;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
}
function hideCustomAlert() { document.getElementById('custom-alert-overlay').style.display = 'none'; }

// Inicializa
selecionar('pizza');
