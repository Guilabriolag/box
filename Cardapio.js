const sabores = [
    { nome: "4 Queijos", desc: "molho, mussarela, parmesão, provolone, gorgonzola, azeitona e orégano", g: 47, b: 37 },
    { nome: "5 Queijos", desc: "molho, mussarela, parmesão, provolone, gorgonzola, catupiry, azeitona e orégano", g: 49, b: 39 },
    { nome: "Abobrinha I", desc: "molho, mussarela, abobrinha, alho frito, azeitona e orégano", g: 41, b: 34 },
    { nome: "Abobrinha II", desc: "molho, mussarela, abobrinha, pimenta calabresa, azeitona e orégano", g: 41, b: 34 },
    { nome: "Alho", desc: "molho, mussarela, alho frito, azeitona e orégano", g: 45, b: 35 },
    { nome: "Aliche", desc: "molho, mussarela, aliche, tomate, azeitona e orégano", g: 49, b: 39 },
    { nome: "Americana", desc: "molho, mussarela, lombinho, pimentão, champignon, tomate cereja, azeitona sem caroço e orégano", g: 50, b: 40 },
    { nome: "Atum I", desc: "molho, atum, cebola, azeitona e orégano", g: 46, b: 36 },
    { nome: "Atum I (com mussarela)", desc: "molho, mussarela, atum, cebola, azeitona e orégano", g: 48, b: 38 },
    { nome: "Bacon", desc: "molho, mussarela, bacon, azeitona e orégano", g: 44, b: 34 },
    { nome: "Brócolis", desc: "molho, brócolis, mussarela, bacon, azeitona e orégano", g: 47, b: 38 },
    { nome: "Calabresa I", desc: "molho, calabresa, tomate, cebola, azeitona e orégano", g: 38, b: 29 },
    { nome: "Calabresa II", desc: "molho, mussarela, calabresa, cebola, azeitona e orégano", g: 43, b: 34 },
    { nome: "Frango Catupiry", desc: "molho, frango, catupiry, azeitona e orégano", g: 47, b: 37 },
    { nome: "Gênova", desc: "molho, mussarela, provolone, presunto, molho pesto e azeitona", g: 48, b: 37 },
    { nome: "Lombinho", desc: "molho, mussarela, lombinho, provolone, azeitona e orégano", g: 46, b: 36 },
    { nome: "Marguerita", desc: "molho, mussarela, parmesão, tomate, azeitona e manjericão", g: 40, b: 30 },
    { nome: "Mussarela", desc: "molho, mussarela, tomate, azeitona e orégano", g: 38, b: 29 },
    { nome: "Peperonni", desc: "molho, mussarela, peperonni e azeitona", g: 49, b: 39 },
    { nome: "Pomodoro", desc: "molho, parmesão, alho frito, tomate e orégano", g: 44, b: 34 },
    { nome: "Potatosa", desc: "molho, batata, parmesão, calabresa, catupiry, azeitona sem caroço e orégano", g: 45, b: 35 },
    { nome: "Portuguesa", desc: "molho, mussarela, presunto, ovo cozido, ervilha, tomate, azeitona sem caroço e orégano", g: 50, b: 40 },
    { nome: "Rúcula e Tomate Seco", desc: "molho, mussarela, rúcula, tomate seco, azeitona e orégano", g: 46, b: 36 },
    { nome: "Toscana", desc: "molho, mussarela, linguiça calabresa moída, tomate, azeitona e orégano", g: 45, b: 35 },
    { nome: "Anita e Garibaldi", desc: "parmesão e goiabada", g: 45, b: 35, doce: true },
    { nome: "Banana", desc: "banana, açúcar, doce de leite e canela", g: 41, b: 31, doce: true }
];

const bebidas = [
    { nome: "Coca-Cola 2L", preco: 18 },
    { nome: "Coca-Cola Zero 2L", preco: 18 },
    { nome: "Guaraná Kuat 2L", preco: 12 },
    { nome: "HEINEKEN", preco: 8 }
];

let catAtual = 'pizza';
let modoMeia = false;
let meiaLista = [];

function selecionar(c) {
    catAtual = c;
    document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+c).classList.add('active');
    document.getElementById('subnav').style.display = (c==='bebidas') ? 'none' : 'flex';
    mostrar('inteira');
}

function mostrar(tipo) {
    modoMeia = (tipo === 'meia');
    document.getElementById('btn-inteira').classList.toggle('active', tipo === 'inteira');
    document.getElementById('btn-meia').classList.toggle('active', tipo === 'meia');
    const container = document.getElementById('sabores');
    container.innerHTML = '';

    if(catAtual === 'bebidas') {
        bebidas.forEach(b => {
            container.innerHTML += createCard(b.nome, 'Refrigerante/Cerveja', b.preco, b.preco);
        });
    } else {
        sabores.forEach(s => {
            let p = (catAtual === 'pizza') ? s.g : s.b;
            container.innerHTML += createCard(s.nome, s.desc, p, p);
        });
    }
}

function createCard(n, d, p) {
    return `<div class="item-card">
        <h3>${n}</h3><p>${d}</p>
        <div class="price-row">
            <span style="font-weight:900; font-size:1.3rem">R$ ${p.toFixed(2)}</span>
            <button class="btn-add" onclick="adicionar('${n}', ${p})">ADD +</button>
        </div>
    </div>`;
}

function adicionar(n, p) {
    const cart = document.getElementById('pedido');
    if(modoMeia && catAtual !== 'bebidas') {
        meiaLista.push({n, p});
        showCustomAlert("1/2 SELECIONADA", "Escolha a outra metade.");
        if(meiaLista.length === 2) {
            let finalP = Math.max(meiaLista[0].p, meiaLista[1].p);
            let label = catAtual === 'pizza' ? "Pizza" : (catAtual === 'broto' ? "Broto" : "Calzone");
            cart.value += `${label} Meia: ${meiaLista[0].n} & ${meiaLista[1].n} - R$ ${finalP.toFixed(2)}\n`;
            meiaLista = [];
            atualizarContador();
        }
    } else {
        let label = catAtual === 'bebidas' ? "Bebida" : (catAtual === 'pizza' ? "Pizza" : (catAtual === 'broto' ? "Broto" : "Calzone"));
        cart.value += `${label}: ${n} - R$ ${p.toFixed(2)}\n`;
        atualizarContador();
        showCustomAlert("ADICIONADO", n + " no carrinho!");
    }
}

function atualizarContador() {
    let count = parseInt(document.getElementById('cart-count').innerText);
    document.getElementById('cart-count').innerText = count + 1;
}

function toggleCarrinho() { document.getElementById('carrinho').classList.toggle('open'); }

function mostrarDados(t) {
    document.getElementById('pedidoDetalhes').style.display = 'block';
    document.getElementById('entregaCampos').style.display = (t==='delivery') ? 'block' : 'none';
    document.getElementById('btn-retirar').classList.toggle('active', t==='retirar');
    document.getElementById('btn-delivery').classList.toggle('active', t==='delivery');
}

function mostrarTroco() {
    const pag = document.getElementById('pagamento').value;
    document.getElementById('trocoArea').style.display = (pag === 'Dinheiro') ? 'block' : 'none';
}

function enviarPedido() {
    const itens = document.getElementById('pedido').value;
    const pag = document.getElementById('pagamento').value;
    if(!itens || !pag) return showCustomAlert("ERRO", "Preencha tudo!");
    const local = document.getElementById('entregaCampos').style.display === 'block' ? 
                  `Entrega: ${document.getElementById('endereco').value} - ${document.getElementById('bairro').value}` : "Retirada Balcão";
    const msg = `*PEDIDO VETORELLI*\n\n${itens}\n📍 ${local}\n💳 Pagamento: ${pag}`;
    window.open(`https://wa.me/5511993407322?text=${encodeURIComponent(msg)}`);
}

function showCustomAlert(t, m) {
    document.getElementById('custom-alert-title').innerText = t;
    document.getElementById('custom-alert-message').innerText = m;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
}
function hideCustomAlert() { document.getElementById('custom-alert-overlay').style.display = 'none'; }

selecionar('pizza');
