const sabores = [
    { nome: "4 Queijos", ingredientes: "Mussarela, parmesão, provolone e gorgonzola", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Calabresa", ingredientes: "Calabresa fatiada, cebola e azeitonas", inteira: 38, broto: 29, categoria: "pizza" },
    { nome: "Frango Catupiry", ingredientes: "Frango desfiado com o legítimo Catupiry", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Portuguesa", ingredientes: "Presunto, ovos, ervilha, cebola e mussarela", inteira: 50, broto: 40, categoria: "pizza" },
    { nome: "Banana", ingredientes: "Banana, açúcar e canela", inteira: 41, broto: 31, categoria: "doce" },
    { nome: "Coca-Cola 2L", preco: 18, categoria: "bebidas" },
    { nome: "Coca-Cola Zero 2L", preco: 18, categoria: "bebidas" },
    { nome: "Guaraná Kuat 2L", preco: 12, categoria: "bebidas" },
    { nome: "Heineken", preco: 10, categoria: "bebidas" }
];

let categoriaAtual = 'pizza';
let modoMeia = false;
let selecionadosMeia = [];
let totalItens = 0;

function selecionar(cat) {
    categoriaAtual = cat;
    document.getElementById('subnav').style.display = (cat === 'pizza' || cat === 'broto') ? 'grid' : 'none';
    mostrar('inteira');
}

function mostrar(tipo) {
    modoMeia = (tipo === 'meia');
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
            <div style="display:flex; justify-content:space-between; align-items:center">
                <span>R$ ${preco.toFixed(2)}</span>
                <button onclick="adicionar('${s.nome}', ${preco})">ADD +</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function adicionar(nome, preco) {
    const cart = document.getElementById('pedido');
    totalItens++;
    document.getElementById('cart-count').innerText = totalItens;

    if (modoMeia && (categoriaAtual === 'pizza' || categoriaAtual === 'broto')) {
        selecionadosMeia.push({nome, preco});
        showCustomAlert("MEIA-MEIA", `SABOR ${selecionadosMeia.length} SELECIONADO!`);
        if (selecionadosMeia.length === 2) {
            const pFinal = Math.max(selecionadosMeia[0].preco, selecionadosMeia[1].preco);
            cart.value += `MEIA ${selecionadosMeia[0].nome} / MEIA ${selecionadosMeia[1].nome} - R$ ${pFinal.toFixed(2)}\n`;
            selecionadosMeia = [];
        }
    } else {
        const label = categoriaAtual.toUpperCase();
        cart.value += `${label}: ${nome} - R$ ${preco.toFixed(2)}\n`;
        showCustomAlert("ADICIONADO", `${nome} JÁ ESTÁ NO CARRINHO!`);
    }
}

function toggleCarrinho() {
    document.getElementById('carrinho').classList.toggle('open');
}

function mostrarDados(tipo) {
    document.getElementById('pedidoDetalhes').style.display = 'block';
    document.getElementById('entregaCampos').style.display = (tipo === 'delivery') ? 'block' : 'none';
}

function enviarPedido() {
    const itens = document.getElementById('pedido').value;
    if (!itens) return;
    const pag = document.getElementById('pagamento').value;
    const msg = encodeURIComponent(`*NOVO PEDIDO VETORELLI*\n\n${itens}\nPagamento: ${pag}`);
    window.open(`https://wa.me/5511993407322?text=${msg}`);
}

function showCustomAlert(t, m) {
    document.getElementById('custom-alert-title').innerText = t;
    document.getElementById('custom-alert-message').innerText = m;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
}

function hideCustomAlert() {
    document.getElementById('custom-alert-overlay').style.display = 'none';
}
